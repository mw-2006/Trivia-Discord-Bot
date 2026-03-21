import { Client, GatewayIntentBits } from "discord.js";
import cron from "node-cron";
import { pickRandomQuestion } from "./questions.js";

const DISCORD_TOKEN = process.env["DISCORD_TOKEN"];
const CHANNEL_ID = process.env["DISCORD_CHANNEL_ID"];
const ROLE_ID = process.env["DISCORD_ROLE_ID"];
const CRON_SCHEDULE = process.env["CRON_SCHEDULE"] ?? "0 9 * * *";

if (!DISCORD_TOKEN) throw new Error("Missing DISCORD_TOKEN secret.");
if (!CHANNEL_ID) throw new Error("Missing DISCORD_CHANNEL_ID secret.");
if (!ROLE_ID) throw new Error("Missing DISCORD_ROLE_ID secret.");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const OPTION_LABELS = ["🇦", "🇧", "🇨", "🇩"];

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

  const message = formatTriviaMessage(ROLE_ID!);
  await channel.send(message);
  console.log("[trivia] Question posted successfully.");
}

client.once("clientReady", () => {
  console.log(`[bot] Logged in as ${client.user?.tag}`);
  console.log(`[bot] Scheduling trivia with cron: ${CRON_SCHEDULE}`);

  cron.schedule(CRON_SCHEDULE, () => {
    postDailyTrivia().catch((err: unknown) => {
      console.error("[trivia] Failed to post:", err);
    });
  });

  console.log("[bot] Scheduler active. Waiting for next trigger...");
});

client.login(DISCORD_TOKEN);
