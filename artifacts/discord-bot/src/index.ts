import { Client, GatewayIntentBits } from "discord.js";
import cron from "node-cron";
import OpenAI from "openai";

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

const openai = new OpenAI({
  baseURL: OPENAI_BASE_URL,
  apiKey: OPENAI_API_KEY,
});

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function generateTriviaQuestion(): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    messages: [
      {
        role: "system",
        content:
          "You are a fun trivia host. Generate a single interesting trivia question with 4 multiple-choice options (A, B, C, D) and reveal the correct answer at the end. Keep it concise and engaging.",
      },
      {
        role: "user",
        content: "Give me a fresh trivia question on any topic.",
      },
    ],
    max_completion_tokens: 300,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No content returned from OpenAI.");
  return content;
}

async function postDailyTrivia(): Promise<void> {
  console.log("[trivia] Generating question...");

  const question = await generateTriviaQuestion();
  const channel = await client.channels.fetch(CHANNEL_ID!);

  if (!channel || !channel.isTextBased()) {
    console.error("[trivia] Channel not found or not a text channel.");
    return;
  }

  const message = `<@&${ROLE_ID}>\n\n🧠 **Daily Trivia Question!**\n\n${question}`;

  await channel.send(message);
  console.log("[trivia] Question posted successfully.");
}

client.once("ready", () => {
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
