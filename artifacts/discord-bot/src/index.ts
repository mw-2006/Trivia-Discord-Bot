import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type TextBasedChannel,
} from "discord.js";
import cron from "node-cron";
import { triviaQuestions } from "./questions.js";
import { loadCustomQuestions, saveCustomQuestion } from "./storage.js";

const DISCORD_TOKEN = process.env["DISCORD_TOKEN"];
const CHANNEL_ID = process.env["DISCORD_CHANNEL_ID"];
const ROLE_ID = process.env["DISCORD_ROLE_ID"];
const CRON_SCHEDULE = process.env["CRON_SCHEDULE"] ?? "0 9 * * *";

if (!DISCORD_TOKEN) throw new Error("Missing DISCORD_TOKEN secret.");
if (!CHANNEL_ID) throw new Error("Missing DISCORD_CHANNEL_ID secret.");
if (!ROLE_ID) throw new Error("Missing DISCORD_ROLE_ID secret.");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const OPTION_LABELS = ["🇦", "🇧", "🇨", "🇩"];

function pickRandomQuestion() {
  const all = [...triviaQuestions, ...loadCustomQuestions()];
  return all[Math.floor(Math.random() * all.length)]!;
}

function formatTriviaMessage(roleId: string): string {
  const { question, options, answer } = pickRandomQuestion();
  const answerIndex = options.indexOf(answer);
  const answerLabel = OPTION_LABELS[answerIndex] ?? "?";
  const optionLines = options
    .map((opt, i) => `${OPTION_LABELS[i]} ${opt}`)
    .join("\n");

  return [
    `<@&${roleId}>`,
    "",
    "🧠 **Daily Trivia Question!**",
    "",
    `**${question}**`,
    "",
    optionLines,
    "",
    `||✅ Answer: ${answerLabel} **${answer}**||`,
  ].join("\n");
}

async function postDailyTrivia(): Promise<void> {
  console.log("[trivia] Picking question...");
  const channel = await client.channels.fetch(CHANNEL_ID!);
  if (!channel || !channel.isTextBased()) {
    console.error("[trivia] Channel not found or not a text channel.");
    return;
  }
  await (channel as TextBasedChannel).send(formatTriviaMessage(ROLE_ID!));
  console.log("[trivia] Question posted successfully.");
}

// Slash command definition
const addTriviaCommand = new SlashCommandBuilder()
  .setName("addtrivia")
  .setDescription("Add a new trivia question to the daily pool")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addStringOption((o) =>
    o.setName("question").setDescription("The trivia question").setRequired(true)
  )
  .addStringOption((o) =>
    o.setName("a").setDescription("Option A").setRequired(true)
  )
  .addStringOption((o) =>
    o.setName("b").setDescription("Option B").setRequired(true)
  )
  .addStringOption((o) =>
    o.setName("c").setDescription("Option C").setRequired(true)
  )
  .addStringOption((o) =>
    o.setName("d").setDescription("Option D").setRequired(true)
  )
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

async function registerCommands(clientId: string): Promise<void> {
  const rest = new REST().setToken(DISCORD_TOKEN!);
  await rest.put(Routes.applicationCommands(clientId), {
    body: [addTriviaCommand.toJSON()],
  });
  console.log("[bot] Slash commands registered globally.");
}

async function handleAddTrivia(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const question = interaction.options.getString("question", true);
  const optA = interaction.options.getString("a", true);
  const optB = interaction.options.getString("b", true);
  const optC = interaction.options.getString("c", true);
  const optD = interaction.options.getString("d", true);
  const answerKey = interaction.options.getString("answer", true);

  const options = [optA, optB, optC, optD];
  const answerMap: Record<string, string> = { a: optA, b: optB, c: optC, d: optD };
  const answer = answerMap[answerKey]!;

  const total = saveCustomQuestion({ question, options, answer });

  const label = OPTION_LABELS[["a", "b", "c", "d"].indexOf(answerKey)] ?? "?";

  await interaction.reply({
    content: [
      "✅ **Trivia question added!**",
      "",
      `**${question}**`,
      options.map((opt, i) => `${OPTION_LABELS[i]} ${opt}`).join("\n"),
      `||✅ Answer: ${label} **${answer}**||`,
      "",
      `📦 Total custom questions in pool: **${total}**`,
    ].join("\n"),
    ephemeral: true,
  });

  console.log(`[trivia] New question added by ${interaction.user.tag}: "${question}"`);
}

client.on("interactionCreate", (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === "addtrivia") {
    handleAddTrivia(interaction).catch((err: unknown) => {
      console.error("[bot] Error handling /addtrivia:", err);
    });
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
