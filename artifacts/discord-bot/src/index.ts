import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type TextBasedChannel,
} from "discord.js";
import cron from "node-cron";
import OpenAI from "openai";
import { triviaQuestions } from "./questions.js";
import { loadCustomQuestions, saveCustomQuestion } from "./storage.js";
import { addXP, getTopScores, XP_CORRECT, XP_CORRECT_WITH_HINT } from "./scores.js";
import {
  DEFAULT_THEME,
  loadGuildConfigs,
  saveGuildConfig,
  getGuildConfig,
  type GuildConfig,
} from "./guild-config.js";
import { getThemeQuestion } from "./theme-questions.js";

const DISCORD_TOKEN = process.env["DISCORD_TOKEN"];
const CHANNEL_ID = process.env["DISCORD_CHANNEL_ID"];
const ROLE_ID = process.env["DISCORD_ROLE_ID"];
const CRON_SCHEDULE = process.env["CRON_SCHEDULE"] ?? "0 9 * * *";
const OPENAI_BASE_URL = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
const OPENAI_API_KEY = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];

if (!DISCORD_TOKEN) throw new Error("Missing DISCORD_TOKEN secret.");
if (!CHANNEL_ID) throw new Error("Missing DISCORD_CHANNEL_ID secret.");
if (!ROLE_ID) throw new Error("Missing DISCORD_ROLE_ID secret.");
if (!OPENAI_BASE_URL) throw new Error("Missing AI_INTEGRATIONS_OPENAI_BASE_URL.");
if (!OPENAI_API_KEY) throw new Error("Missing AI_INTEGRATIONS_OPENAI_API_KEY.");

const openai = new OpenAI({ baseURL: OPENAI_BASE_URL, apiKey: OPENAI_API_KEY });
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const OPTION_LABELS = ["🇦", "🇧", "🇨", "🇩"];
const OPTION_KEYS = ["a", "b", "c", "d"];

// In-memory map of messageId -> active question state
interface ActiveQuestion {
  question: string;
  answer: string;
  options: string[];
  answered: Set<string>;
  hint: string | null;
  hintUsers: Set<string>;
  theme: string;
}
const activeQuestions = new Map<string, ActiveQuestion>();

// --- Helpers ---

function pickDefaultQuestion() {
  const all = [...triviaQuestions, ...loadCustomQuestions()];
  return all[Math.floor(Math.random() * all.length)]!;
}

async function pickQuestion(theme: string) {
  if (theme === DEFAULT_THEME) return pickDefaultQuestion();
  return getThemeQuestion(theme, openai);
}

async function generateHint(question: string, answer: string, theme: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 100,
    messages: [
      {
        role: "system",
        content: `You write short, helpful hints for trivia questions about: ${theme}. The hint should nudge the player in the right direction without revealing the answer directly. Keep it to 1–2 sentences.`,
      },
      {
        role: "user",
        content: `Question: "${question}"\nCorrect answer: "${answer}"\n\nWrite a hint.`,
      },
    ],
  });
  return (
    response.choices[0]?.message?.content?.trim() ??
    "Think carefully about the topic and what you know!"
  );
}

function buildTriviaComponents(options: string[]) {
  const answerRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    options.map((opt, i) =>
      new ButtonBuilder()
        .setCustomId(`trivia_${OPTION_KEYS[i]}`)
        .setLabel(`${["A", "B", "C", "D"][i]}: ${opt}`)
        .setStyle(ButtonStyle.Primary)
    )
  );

  const hintRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("trivia_hint")
      .setLabel("💡 Get a Hint")
      .setStyle(ButtonStyle.Secondary)
  );

  return [answerRow, hintRow];
}

function buildTriviaContent(roleId: string, question: string): string {
  return [
    `<@&${roleId}>`,
    "",
    "🧠 **Daily Trivia Question!**",
    "",
    `**${question}**`,
    "",
    "_Click a button to answer. Only your first answer counts! Use 💡 for a hint._",
  ].join("\n");
}

async function postDailyTrivia(config: GuildConfig): Promise<void> {
  const { channelId, roleId, theme } = config;
  console.log(`[trivia] Picking question for theme: "${theme}"...`);

  const { question, options, answer, hint } = await pickQuestion(theme);

  const channel = await client.channels.fetch(channelId);
  if (!channel || !channel.isTextBased()) {
    console.error(`[trivia] Channel ${channelId} not found or not a text channel.`);
    return;
  }

  const msg = await (channel as TextBasedChannel).send({
    content: buildTriviaContent(roleId, question),
    components: buildTriviaComponents(options),
  });

  activeQuestions.set(msg.id, {
    question,
    answer,
    options,
    answered: new Set(),
    hint: hint ?? null,
    hintUsers: new Set(),
    theme,
  });

  console.log(`[trivia] Question posted (message ${msg.id}).`);
}

// --- Button handlers ---

async function handleHintButton(interaction: ButtonInteraction, state: ActiveQuestion): Promise<void> {
  state.hintUsers.add(interaction.user.id);

  if (state.hint === null) {
    await interaction.deferReply({ ephemeral: true });
    try {
      state.hint = await generateHint(state.question, state.answer, state.theme);
    } catch (err) {
      console.error("[hint] Failed to generate hint:", err);
      state.hint = "Think carefully about the topic and what you know!";
    }
    await interaction.editReply(
      `💡 **Hint:** ${state.hint}\n\n_Note: using a hint reduces your XP to **${XP_CORRECT_WITH_HINT} XP** if correct._`
    );
  } else {
    await interaction.reply({
      content: `💡 **Hint:** ${state.hint}\n\n_Note: using a hint reduces your XP to **${XP_CORRECT_WITH_HINT} XP** if correct._`,
      ephemeral: true,
    });
  }
}

async function handleAnswerButton(interaction: ButtonInteraction, state: ActiveQuestion): Promise<void> {
  if (state.answered.has(interaction.user.id)) {
    await interaction.reply({ content: "You've already answered this question!", ephemeral: true });
    return;
  }

  state.answered.add(interaction.user.id);

  const pickedKey = interaction.customId.replace("trivia_", "");
  const pickedIndex = OPTION_KEYS.indexOf(pickedKey);
  const pickedOption = state.options[pickedIndex] ?? "";
  const isCorrect = pickedOption === state.answer;

  const correctIndex = state.options.indexOf(state.answer);
  const correctLabel = `${["A", "B", "C", "D"][correctIndex]}: ${state.answer}`;

  if (isCorrect) {
    const usedHint = state.hintUsers.has(interaction.user.id);
    const xpEarned = usedHint ? XP_CORRECT_WITH_HINT : XP_CORRECT;
    const totalXP = addXP(interaction.user.id, xpEarned);
    await interaction.reply({
      content: [
        `✅ **Correct!** The answer was **${correctLabel}**.`,
        `+**${xpEarned} XP**${usedHint ? " _(hint used)_" : ""} — Total: **${totalXP} XP**`,
      ].join("\n"),
      ephemeral: true,
    });
  } else {
    await interaction.reply({
      content: `❌ **Wrong!** You picked **${["A", "B", "C", "D"][pickedIndex]}: ${pickedOption}**.\nThe correct answer was **${correctLabel}**.`,
      ephemeral: true,
    });
  }
}

async function handleTriviaButton(interaction: ButtonInteraction): Promise<void> {
  const state = activeQuestions.get(interaction.message.id);
  if (!state) {
    await interaction.reply({ content: "⚠️ This question is no longer active.", ephemeral: true });
    return;
  }

  if (interaction.customId === "trivia_hint") {
    await handleHintButton(interaction, state);
  } else {
    await handleAnswerButton(interaction, state);
  }
}

// --- Slash commands ---

const addTriviaCommand = new SlashCommandBuilder()
  .setName("addtrivia")
  .setDescription("Add a new trivia question to the daily pool")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addStringOption((o) =>
    o.setName("question").setDescription("The trivia question").setRequired(true)
  )
  .addStringOption((o) => o.setName("a").setDescription("Option A").setRequired(true))
  .addStringOption((o) => o.setName("b").setDescription("Option B").setRequired(true))
  .addStringOption((o) => o.setName("c").setDescription("Option C").setRequired(true))
  .addStringOption((o) => o.setName("d").setDescription("Option D").setRequired(true))
  .addStringOption((o) =>
    o
      .setName("answer")
      .setDescription("Which option is correct?")
      .setRequired(true)
      .addChoices(
        { name: "A", value: "a" },
        { name: "B", value: "b" },
        { name: "C", value: "c" },
        { name: "D", value: "d" }
      )
  )
  .addStringOption((o) =>
    o
      .setName("hint")
      .setDescription("Optional hint shown when users click 💡 (leave blank to auto-generate)")
      .setRequired(false)
  );

const leaderboardCommand = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("Show the trivia leaderboard");

const postTriviaCommand = new SlashCommandBuilder()
  .setName("posttrivia")
  .setDescription("Manually post a trivia question right now (staff only)")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

const setThemeCommand = new SlashCommandBuilder()
  .setName("settheme")
  .setDescription("Set the trivia topic for this server (staff only)")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addStringOption((o) =>
    o
      .setName("theme")
      .setDescription(
        'Describe the trivia topic, e.g. "Taylor Swift discography" or "Marvel Cinematic Universe"'
      )
      .setRequired(true)
  );

const setupCommand = new SlashCommandBuilder()
  .setName("setup")
  .setDescription("Set up the trivia bot for this server (staff only)")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addStringOption((o) =>
    o.setName("channel_id").setDescription("Channel ID to post trivia in").setRequired(true)
  )
  .addStringOption((o) =>
    o.setName("role_id").setDescription("Role ID to ping for trivia").setRequired(true)
  );

// --- Command handlers ---

async function handleAddTrivia(interaction: ChatInputCommandInteraction): Promise<void> {
  const question = interaction.options.getString("question", true);
  const optA = interaction.options.getString("a", true);
  const optB = interaction.options.getString("b", true);
  const optC = interaction.options.getString("c", true);
  const optD = interaction.options.getString("d", true);
  const answerKey = interaction.options.getString("answer", true);
  const hint = interaction.options.getString("hint", false) ?? undefined;

  const options = [optA, optB, optC, optD];
  const answerMap: Record<string, string> = { a: optA, b: optB, c: optC, d: optD };
  const answer = answerMap[answerKey]!;
  const label = `${["A", "B", "C", "D"][OPTION_KEYS.indexOf(answerKey)]}: ${answer}`;

  const total = saveCustomQuestion({ question, options, answer, hint });

  await interaction.reply({
    content: [
      "✅ **Trivia question added!**",
      "",
      `**${question}**`,
      options.map((opt, i) => `${OPTION_LABELS[i]} ${opt}`).join("\n"),
      `Correct answer: **${label}**`,
      hint ? `💡 Hint: ${hint}` : "💡 Hint: will be auto-generated by AI when requested",
      "",
      `📦 Total custom questions in pool: **${total}**`,
    ].join("\n"),
    ephemeral: true,
  });

  console.log(`[trivia] New question added by ${interaction.user.tag}: "${question}"`);
}

async function handleLeaderboard(interaction: ChatInputCommandInteraction): Promise<void> {
  const top = getTopScores(10);

  if (top.length === 0) {
    await interaction.reply({
      content: "📊 No scores yet — answer today's trivia question to get on the board!",
    });
    return;
  }

  const medals = ["🥇", "🥈", "🥉"];
  const rows = top.map(({ userId, xp }, i) => {
    const medal = medals[i] ?? `**${i + 1}.**`;
    return `${medal} <@${userId}> — **${xp} XP**`;
  });

  await interaction.reply({ content: ["🏆 **Trivia Leaderboard**", "", ...rows].join("\n") });
}

async function handlePostTrivia(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const guildId = interaction.guildId;
  const guildConfig = guildId ? getGuildConfig(guildId) : null;
  const config: GuildConfig = guildConfig ?? {
    channelId: CHANNEL_ID!,
    roleId: ROLE_ID!,
    theme: DEFAULT_THEME,
  };
  await postDailyTrivia(config);
  await interaction.editReply("✅ Trivia question posted!");
}

async function handleSetTheme(interaction: ChatInputCommandInteraction): Promise<void> {
  const theme = interaction.options.getString("theme", true).trim();
  const guildId = interaction.guildId;

  if (!guildId) {
    await interaction.reply({ content: "❌ This command must be used in a server.", ephemeral: true });
    return;
  }

  saveGuildConfig(guildId, { theme });

  await interaction.reply({
    content: [
      `✅ **Trivia theme updated!**`,
      ``,
      `This server's trivia topic is now: **${theme}**`,
      ``,
      `Questions will be AI-generated for this topic. Use \`/posttrivia\` to test it right away!`,
    ].join("\n"),
    ephemeral: true,
  });

  console.log(`[config] Guild ${guildId} set theme: "${theme}"`);
}

async function handleSetup(interaction: ChatInputCommandInteraction): Promise<void> {
  const channelId = interaction.options.getString("channel_id", true).trim();
  const roleId = interaction.options.getString("role_id", true).trim();
  const guildId = interaction.guildId;

  if (!guildId) {
    await interaction.reply({ content: "❌ This command must be used in a server.", ephemeral: true });
    return;
  }

  const existing = getGuildConfig(guildId);
  saveGuildConfig(guildId, {
    channelId,
    roleId,
    theme: existing?.theme ?? DEFAULT_THEME,
  });

  await interaction.reply({
    content: [
      `✅ **Bot configured for this server!**`,
      ``,
      `📢 Trivia channel: <#${channelId}>`,
      `🔔 Ping role: <@&${roleId}>`,
      `🎯 Theme: **${existing?.theme ?? DEFAULT_THEME}**`,
      ``,
      `Use \`/settheme\` to change the trivia topic. Use \`/posttrivia\` to post a question now!`,
    ].join("\n"),
    ephemeral: true,
  });

  console.log(`[config] Guild ${guildId} set up with channel ${channelId} and role ${roleId}`);
}

async function registerCommands(clientId: string): Promise<void> {
  const rest = new REST().setToken(DISCORD_TOKEN!);
  await rest.put(Routes.applicationCommands(clientId), {
    body: [
      addTriviaCommand.toJSON(),
      leaderboardCommand.toJSON(),
      postTriviaCommand.toJSON(),
      setThemeCommand.toJSON(),
      setupCommand.toJSON(),
    ],
  });
  console.log("[bot] Slash commands registered globally.");
}

// --- Interaction router ---

client.on("interactionCreate", (interaction) => {
  if (interaction.isButton() && interaction.customId.startsWith("trivia_")) {
    handleTriviaButton(interaction).catch((err: unknown) => {
      console.error("[bot] Error handling button:", err);
    });
    return;
  }

  if (interaction.isChatInputCommand()) {
    const handlers: Record<string, (i: ChatInputCommandInteraction) => Promise<void>> = {
      addtrivia: handleAddTrivia,
      leaderboard: handleLeaderboard,
      posttrivia: handlePostTrivia,
      settheme: handleSetTheme,
      setup: handleSetup,
    };

    const handler = handlers[interaction.commandName];
    if (handler) {
      handler(interaction).catch((err: unknown) => {
        console.error(`[bot] Error handling /${interaction.commandName}:`, err);
      });
    }
  }
});

client.once("clientReady", async () => {
  console.log(`[bot] Logged in as ${client.user?.tag}`);

  registerCommands(client.user!.id).catch((err: unknown) => {
    console.error("[bot] Failed to register slash commands:", err);
  });

  // Resolve the home guild ID from the env-var channel
  let homeGuildId: string | null = null;
  try {
    const homeChannel = await client.channels.fetch(CHANNEL_ID!);
    if (homeChannel && "guildId" in homeChannel) {
      homeGuildId = (homeChannel as { guildId: string }).guildId;
    }
  } catch {
    console.warn("[bot] Could not resolve home guild from DISCORD_CHANNEL_ID.");
  }

  console.log(`[bot] Scheduling trivia with cron: ${CRON_SCHEDULE}`);
  cron.schedule(CRON_SCHEDULE, async () => {
    // Home server always uses env-var channel/role, theme from guild config or default
    const homeTheme = homeGuildId
      ? (getGuildConfig(homeGuildId)?.theme ?? DEFAULT_THEME)
      : DEFAULT_THEME;

    await postDailyTrivia({ channelId: CHANNEL_ID!, roleId: ROLE_ID!, theme: homeTheme }).catch(
      (err: unknown) => console.error("[trivia] Home guild post failed:", err)
    );

    // All other guilds that have been set up via /setup
    const configs = loadGuildConfigs();
    for (const [guildId, config] of Object.entries(configs)) {
      if (guildId === homeGuildId) continue; // already handled above
      if (!config.channelId || !config.roleId) continue;
      await postDailyTrivia(config).catch((err: unknown) =>
        console.error(`[trivia] Guild ${guildId} post failed:`, err)
      );
    }
  });

  const customCount = loadCustomQuestions().length;
  const totalCount = triviaQuestions.length + customCount;
  console.log(
    `[bot] Scheduler active. Pool: ${triviaQuestions.length} built-in + ${customCount} custom = ${totalCount} total.`
  );
});

client.login(DISCORD_TOKEN);
