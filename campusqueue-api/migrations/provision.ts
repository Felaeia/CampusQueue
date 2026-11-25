import { readFile } from "node:fs/promises";
import { provision } from "./accounts.ts";

const [path, ...flags] = process.argv.slice(2);
if (!path || flags.some((flag) => flag !== "--reset-password" && flag !== "--demo")) {
  throw new Error("Usage: npm run provision -- <profile.json> [--reset-password] [--demo]");
}
const input = JSON.parse(await readFile(path, "utf8"));
const changed = await provision(input, { reset: flags.includes("--reset-password"), demo: flags.includes("--demo") });
console.log(changed ? "CampusQueue account credentials saved." : "CampusQueue account already provisioned.");
