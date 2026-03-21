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
import { incrementScore, getTopScores } from "./scores.js";

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
  hint: string | null; // null = not yet generated, string = cached
  hintRequested: boolean;
}
const activeQuestions = new Map<string, ActiveQuestion>();

// --- Helpers ---

function pickRandomQuestion() {
  const all = [...triviaQuestions, ...loadCustomQuestions()];
  return all[Math.floor(Math.random() * all.length)]!;
}

async function generateHint(question: string, answer: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 100,
    messages: [
      {
        role: "system",
        content:
          "You write short, helpful hints for trivia questions about the Ice Planet Hockey book series (Heated Rivalry / Common Goal by Rachel Reid). The hint should nudge the player in the right direction without revealing the answer directly. Keep it to 1–2 sentences.",
      },
      {
        role: "user",
        content: `Question: "${question}"\nCorrect answer: "${answer}"\n\nWrite a hint.`,
      },
    ],
  });
  return response.choices[0]?.message?.content?.trim() ?? "Think carefully about the characters and where key scenes take place!";
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

async function postDailyTrivia(): Promise<void> {
  console.log("[trivia] Picking question...");
  const { question, options, answer, hint } = pickRandomQuestion();

  const channel = await client.channels.fetch(CHANNEL_ID!);
  if (!channel || !channel.isTextBased()) {
    console.error("[trivia] Channel not found or not a text channel.");
    return;
  }

  const msg = await (channel as TextBasedChannel).send({
    content: buildTriviaContent(ROLE_ID!, question),
    components: buildTriviaComponents(options),
  });

  activeQuestions.set(msg.id, {
    question,
    answer,
    options,
    answered: new Set(),
    hint: hint ?? null,
    hintRequested: false,
  });

  console.log(`[trivia] Question posted (message ${msg.id}).`);
}

// --- Button handlers ---

async function handleHintButton(interaction: ButtonInteraction, state: ActiveQuestion): Promise<void> {
  // If no hint yet, generate and cache it
  if (state.hint === null) {
    await interaction.deferReply({ ephemeral: true });
    state.hintRequested = true;
    try {
      state.hint = await generateHint(state.question, state.answer);
    } catch (err) {
      console.error("[hint] Failed to generate hint:", err);
      state.hint = "Think carefully about the characters and where key scenes take place!";
    }
    await interaction.editReply(`💡 **Hint:** ${state.hint}`);
  } else {
    await interaction.reply({ content: `💡 **Hint:** ${state.hint}`, ephemeral: true });
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
    const newScore = incrementScore(interaction.user.id);
    await interaction.reply({
      content: `✅ **Correct!** The answer was **${correctLabel}**.\nYour score: **${newScore}** correct ${newScore === 1 ? "answer" : "answers"}!`,
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
  const rows = top.map(({ userId, score }, i) => {
    const medal = medals[i] ?? `**${i + 1}.**`;
    return `${medal} <@${userId}> — **${score}** correct ${score === 1 ? "answer" : "answers"}`;
  });

  await interaction.reply({ content: ["🏆 **Trivia Leaderboard**", "", ...rows].join("\n") });
}

async function handlePostTrivia(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  await postDailyTrivia();
  await interaction.editReply("✅ Trivia question posted!");
}

async function registerCommands(clientId: string): Promise<void> {
  const rest = new REST().setToken(DISCORD_TOKEN!);
  await rest.put(Routes.applicationCommands(clientId), {
    body: [addTriviaCommand.toJSON(), leaderboardCommand.toJSON(), postTriviaCommand.toJSON()],
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
    if (interaction.commandName === "addtrivia") {
      handleAddTrivia(interaction).catch((err: unknown) => {
        console.error("[bot] Error handling /addtrivia:", err);
      });
    } else if (interaction.commandName === "leaderboard") {
      handleLeaderboard(interaction).catch((err: unknown) => {
        console.error("[bot] Error handling /leaderboard:", err);
      });
    } else if (interaction.commandName === "posttrivia") {
      handlePostTrivia(interaction).catch((err: unknown) => {
        console.error("[bot] Error handling /posttrivia:", err);
      });
    }
  }
});

client.once("clientReady", () => {
  console.log(`[bot] Logged in as ${client.user?.tag}`);

  registerCommands(client.user!.id).catch((err: unknown) => {
    console.error("[bot] Failed to register slash commands:", err);
  });

  console.log(`[bot] Scheduling trivia with cron: ${CRON_SCHEDULE}`);
  cron.schedule(CRON_SCHEDULE, () => {
    postDailyTrivia().catch((err: unknown) => {
      console.error("[trivia] Failed to post:", err);
    });
  });

  const customCount = loadCustomQuestions().length;
  const totalCount = triviaQuestions.length + customCount;
  console.log(
    `[bot] Scheduler active. Pool: ${triviaQuestions.length} built-in + ${customCount} custom = ${totalCount} total.`
  );
});

client.login(DISCORD_TOKEN);
