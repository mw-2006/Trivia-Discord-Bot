import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import type { TriviaQuestion } from "./questions.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const FILE_PATH = join(DATA_DIR, "custom-questions.json");

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadCustomQuestions(): TriviaQuestion[] {
  ensureDataDir();
  if (!existsSync(FILE_PATH)) return [];
  try {
    const raw = readFileSync(FILE_PATH, "utf-8");
    return JSON.parse(raw) as TriviaQuestion[];
  } catch {
    return [];
  }
}

export function saveCustomQuestion(q: TriviaQuestion): number {
  ensureDataDir();
  const existing = loadCustomQuestions();
  existing.push(q);
  writeFileSync(FILE_PATH, JSON.stringify(existing, null, 2), "utf-8");
  return existing.length;
}
