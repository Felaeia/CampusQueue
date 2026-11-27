import { readFile } from "node:fs/promises";
import { provision } from "./accounts.ts";

if (process.env.ENABLE_DEMO_LOGIN !== "true") {
  throw new Error("Set ENABLE_DEMO_LOGIN=true in the development API environment before seeding demo accounts");
}
const accounts = JSON.parse(await readFile(new URL("./demo-accounts.json", import.meta.url), "utf8"));
for (const account of accounts) {
  const { changed } = await provision(account, { demo: true, reset: false });
  console.log(`${account.loginId}: ${changed ? "provisioned" : "already provisioned"}`);
}
