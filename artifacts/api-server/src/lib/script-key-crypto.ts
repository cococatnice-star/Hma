import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newScriptKey() {
  const bytes = randomBytes(15);
  const body = [...bytes].map(value => ALPHABET[value & 31]).join("");
  return `COCOX-${body.slice(0, 5)}-${body.slice(5, 10)}-${body.slice(10)}`;
}
export function canonicalKey(value: string) {
  const key = value.trim().toUpperCase();
  if (!/^COCOX-[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/.test(key)) {
    return null;
  }
  return key;
}
export const keyDigest = (key: string) => createHash("sha256").update(key).digest("hex");
function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Script key encryption is unavailable");
  return createHash("sha256").update(`cocox-script-keys:${secret}`).digest();
}
export function encryptScriptKey(key: string, id: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  cipher.setAAD(Buffer.from(id));
  const encrypted = Buffer.concat([cipher.update(key, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(value => value.toString("hex")).join(".");
}
export function decryptScriptKey(encrypted: string, id: string) {
  const [iv, tag, data] = encrypted.split(".").map(value => Buffer.from(value, "hex"));
  const cipher = createDecipheriv("aes-256-gcm", secretKey(), iv);
  cipher.setAAD(Buffer.from(id));
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data), cipher.final()]).toString("utf8");
}
export function privateFingerprint(namespace: string, value: string) {
  return createHmac("sha256", secretKey()).update(`${namespace}:${value}`).digest("hex");
}
