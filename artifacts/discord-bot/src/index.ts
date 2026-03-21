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
import { triviaQuestions } from "./questions.js";
import { loadCustomQuestions, saveCustomQuestion } from "./storage.js";
import { incrementScore, getTopScores } from "./scores.js";

const DISCORD_TOKEN = process.env["DISCORD_TOKEN"];
const CHANNEL_ID = process.env["DISCORD_CHANNEL_ID"];
const ROLE_ID = process.env["DISCORD_ROLE_ID"];
const CRON_SCHEDULE = process.env["CRON_SCHEDULE"] ?? "0 9 * * *";

if (!DISCORD_TOKEN) throw new Error("Missing DISCORD_TOKEN secret.");
if (!CHANNEL_ID) throw new Error("Missing DISCORD_CHANNEL_ID secret.");
if (!ROLE_ID) throw new Error("Missing DISCORD_ROLE_ID secret.");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const OPTION_LABELS = ["🇦", "🇧", "🇨", "🇩"];
const OPTION_KEYS = ["a", "b", "c", "d"];

// In-memory map of messageId -> active question state
interface ActiveQuestion {
  answer: string;
  options: string[];
  answered: Set<string>;
}
const activeQuestions = new Map<string, ActiveQuestion>();

function pickRandomQuestion() {
  const all = [...triviaQuestions, ...loadCustomQuestions()];
  return all[Math.floor(Math.random() * all.length)]!;
}

function buildTriviaComponents(options: string[]) {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    options.map((opt, i) =>
      new ButtonBuilder()
        .setCustomId(`trivia_${OPTION_KEYS[i]}`)
        .setLabel(`${["A", "B", "C", "D"][i]}: ${opt}`)
        .setStyle(ButtonStyle.Primary)
    )
  );
  return [row];
}

function buildTriviaContent(roleId: string, question: string): string {
  return [
    `<@&${roleId}>`,
    "",
    "🧠 **Daily Trivia Question!**",
    "",
    `**${question}**`,
    "",
    "_Click a button below to answer. Only your first answer counts!_",
  ].join("\n");
}

async function postDailyTrivia(): Promise<void> {
  console.log("[trivia] Picking question...");
  const { question, options, answer } = pickRandomQuestion();

  const channel = await client.channels.fetch(CHANNEL_ID!);
  if (!channel || !channel.isTextBased()) {
    console.error("[trivia] Channel not found or not a text channel.");
    return;
  }

  const msg = await (channel as TextBasedChannel).send({
    content: buildTriviaContent(ROLE_ID!, question),
    components: buildTriviaComponents(options),
  });

  activeQuestions.set(msg.id, { answer, options, answered: new Set() });
  console.log(`[trivia] Question posted (message ${msg.id}).`);
}

// --- Button handler ---

async function handleTriviaButton(interaction: ButtonInteraction): Promise<void> {
  const state = activeQuestions.get(interaction.message.id);
  if (!state) {
    await interaction.reply({
      content: "⚠️ This question is no longer active.",
      ephemeral: true,
    });
    return;
  }

  if (state.answered.has(interaction.user.id)) {
    await interaction.reply({
      content: "You've already answered this question!",
      ephemeral: true,
    });
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
  );

const leaderboardCommand = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("Show the trivia leaderboard");

async function handleAddTrivia(interaction: ChatInputCommandInteraction): Promise<void> {
  const question = interaction.options.getString("question", true);
  const optA = interaction.options.getString("a", true);
  const optB = interaction.options.getString("b", true);
  const optC = interaction.options.getString("c", true);
  const optD = interaction.options.getString("d", true);
  const answerKey = interaction.options.getString("answer", true);

  const options = [optA, optB, optC, optD];
  const answerMap: Record<string, string> = { a: optA, b: optB, c: optC, d: optD };
  const answer = answerMap[answerKey]!;
  const label = `${["A", "B", "C", "D"][OPTION_KEYS.indexOf(answerKey)]}: ${answer}`;

  const total = saveCustomQuestion({ question, options, answer });

  await interaction.reply({
    content: [
      "✅ **Trivia question added!**",
      "",
      `**${question}**`,
      options.map((opt, i) => `${OPTION_LABELS[i]} ${opt}`).join("\n"),
      `Correct answer: **${label}**`,
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
      ephemeral: false,
    });
    return;
  }

  const medals = ["🥇", "🥈", "🥉"];
  const rows = top.map(({ userId, score }, i) => {
    const medal = medals[i] ?? `**${i + 1}.**`;
    return `${medal} <@${userId}> — **${score}** correct ${score === 1 ? "answer" : "answers"}`;
  });

  await interaction.reply({
    content: ["🏆 **Trivia Leaderboard**", "", ...rows].join("\n"),
    ephemeral: false,
  });
}

async function registerCommands(clientId: string): Promise<void> {
  const rest = new REST().setToken(DISCORD_TOKEN!);
  await rest.put(Routes.applicationCommands(clientId), {
    body: [addTriviaCommand.toJSON(), leaderboardCommand.toJSON()],
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
