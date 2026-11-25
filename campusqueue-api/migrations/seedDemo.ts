import { readFile } from "node:fs/promises";
import { provision } from "./accounts.ts";

if (process.env.ENABLE_DEMO_LOGIN !== "true") {
  throw new Error("Set ENABLE_DEMO_LOGIN=true in the development API environment before seeding demo accounts");
}
const load = async (name: string) => JSON.parse(await readFile(
  new URL(`../../campusqueue-mobile/src/data/${name}.json`, import.meta.url), "utf8",
));
const { staffAccounts } = await load("staffRegistrarData");
const { authDefaults, studentAccounts } = await load("mockData");
const student = studentAccounts.find(({ profile }: { profile: { usn: string } }) => profile.usn === authDefaults.defaultUsn);
if (!student) throw new Error("The default demo student is not in the frontend fixtures");
const staff = ["EMP-1042", "EMP-1043"].map((id) => {
  const account = staffAccounts.find(({ staffId }: { staffId: string }) => staffId === id);
  if (!account) throw new Error(`Missing demo fixture for ${id}`);
  return { ...account, loginId: account.staffId, fullName: account.staffName };
});
const accounts = [...staff, {
  ...student.profile, email: "", loginId: authDefaults.defaultUsn,
  role: "student", password: authDefaults.defaultPassword,
}];
for (const account of accounts) {
  const changed = await provision(account, { demo: true, reset: false });
  console.log(`${account.loginId}: ${changed ? "provisioned" : "already provisioned"}`);
}
