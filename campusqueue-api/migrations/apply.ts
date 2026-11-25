import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { applyMigrations } from "./schema.ts";

const [mode = "--dry-run", target, ...extra] = process.argv.slice(2);
if (!["--dry-run", "--apply", "--interactive"].includes(mode) || extra.length ||
    (mode !== "--apply" && target !== undefined)) {
  throw new Error("Use --dry-run, --apply <project-id>, or --interactive");
}

const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) throw new Error("Set FIREBASE_PROJECT_ID in campusqueue-api/.env");
const production = projectId === process.env.FIREBASE_PRODUCTION_PROJECT_ID;

if (mode === "--interactive") {
  if (process.env.VERCEL_ENV || !stdin.isTTY) {
    throw new Error("Run the interactive migration from a local terminal");
  }
  console.log(`Firebase project: ${projectId}${production ? " (production)" : ""}`);
  console.log(JSON.stringify({ mode: "--dry-run", ...await applyMigrations(true) }, null, 2));
  const prompt = createInterface({ input: stdin, output: stdout });
  let confirmation: string;
  try {
    confirmation = await prompt.question("Type the exact Firebase project ID to apply, or press Enter to cancel: ");
  } finally {
    prompt.close();
  }
  if (confirmation === projectId) {
    console.log(JSON.stringify({ mode: "--apply", ...await applyMigrations(false) }, null, 2));
  } else {
    console.log("Migration cancelled. No changes were written.");
    if (confirmation !== "") process.exitCode = 1;
  }
} else {
  if (mode === "--apply" && target !== projectId) {
    throw new Error("Supply the exact configured project ID after --apply");
  }
  if (mode === "--apply" && (process.env.VERCEL_ENV === "production" || production)) {
    throw new Error("For production, run migrate-firestore.bat or use --interactive from a local terminal");
  }
  console.log(JSON.stringify({ mode, ...await applyMigrations(mode === "--dry-run") }, null, 2));
}
