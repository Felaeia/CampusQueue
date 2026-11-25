import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const keyLength = 64;
const options = { N: 32768, r: 8, p: 2, maxmem: 64 * 1024 * 1024 };

export function validPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= 128;
}

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(24).toString("base64url");
  return `scrypt-v1:${salt}:${(await derive(password, salt)).toString("base64url")}`;
}

export async function checkPassword(password: string, encoded: unknown): Promise<boolean> {
  const fields = typeof encoded === "string" ? /^scrypt-v1:([\w-]{32}):([\w-]{86})$/.exec(encoded) : null;
  // Match the hashing work for IDs without stored credentials.
  const actual = await derive(password, fields?.[1] ?? "campusqueue-unknown-user");
  return !!fields && timingSafeEqual(actual, Buffer.from(fields[2], "base64url"));
}

export function demoLoginAllowed(profile: { demoAccount?: boolean }): boolean {
  return profile.demoAccount !== true || process.env.ENABLE_DEMO_LOGIN === "true";
}
