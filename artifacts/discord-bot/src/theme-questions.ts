import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import type OpenAI from "openai";
import type { TriviaQuestion } from "./questions.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const GENERATED_FILE = join(DATA_DIR, "generated-questions.json");

const BATCH_SIZE = 10;
const REFILL_THRESHOLD = 3;

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadGeneratedPool(): Record<string, TriviaQuestion[]> {
  ensureDataDir();
  if (!existsSync(GENERATED_FILE)) return {};
  try {
    return JSON.parse(readFileSync(GENERATED_FILE, "utf-8")) as Record<string, TriviaQuestion[]>;
  } catch {
    return {};
  }
}

function saveGeneratedPool(data: Record<string, TriviaQuestion[]>): void {
  ensureDataDir();
  writeFileSync(GENERATED_FILE, JSON.stringify(data, null, 2), "utf-8");
}

async function generateBatch(theme: string, openai: OpenAI): Promise<TriviaQuestion[]> {
  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 2000,
    messages: [
      {
        role: "system",
        content: `You generate multiple-choice trivia questions. Return ONLY a valid JSON array with no markdown or explanation. Each object must have exactly these fields: "question" (string), "options" (array of exactly 4 strings), "answer" (string — must exactly match one of the options).`,
      },
      {
        role: "user",
        content: `Generate ${BATCH_SIZE} trivia questions about: ${theme}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content?.trim() ?? "[]";
  const cleaned = raw.replace(/^```(?:json)?|```$/gm, "").trim();
  const parsed = JSON.parse(cleaned) as Array<{
    question: string;
    options: string[];
    answer: string;
  }>;

  return parsed.map((q) => ({
    question: q.question,
    options: q.options,
    answer: q.answer,
  }));
}

export async function getThemeQuestion(theme: string, openai: OpenAI): Promise<TriviaQuestion> {
  const pool = loadGeneratedPool();
  const questions = pool[theme] ?? [];

  if (questions.length <= REFILL_THRESHOLD) {
    console.log(`[theme] Generating ${BATCH_SIZE} questions for theme: "${theme}"...`);
    try {
      const newBatch = await generateBatch(theme, openai);
      pool[theme] = [...questions, ...newBatch];
      saveGeneratedPool(pool);
    } catch (err) {
      console.error("[theme] Failed to generate questions:", err);
    }
  }

  const updated = pool[theme] ?? [];
  if (updated.length === 0) throw new Error(`No questions available for theme: ${theme}`);

  const idx = Math.floor(Math.random() * updated.length);
  const question = updated.splice(idx, 1)[0]!;
  pool[theme] = updated;
  saveGeneratedPool(pool);

  return question;
}
