import { randomUUID } from "node:crypto";
import { ObjectStorageService, objectStorageClient } from "./objectStorage";
import { setObjectAclPolicy } from "./objectAcl";

const storage = new ObjectStorageService();
export const MAX_LUA_BYTES = 1024 * 1024;

export function validateLuaSource(source: string) {
  if (!source.trim() || Buffer.byteLength(source) > MAX_LUA_BYTES || source.includes("\0")) {
    throw new Error("Upload a non-empty UTF-8 Lua or TXT file, no larger than 1 MiB.");
  }
  if (/^\s*(?:const\s+\w+\s*=|export\s+default|<!DOCTYPE|<html)/i.test(source)) {
    throw new Error("Upload raw Lua code, not Cloudflare JavaScript or an HTML page.");
  }
}
export async function storeScriptSource(source: string, creatorId: string) {
  validateLuaSource(source);
  const dir = storage.getPrivateObjectDir().replace(/^\/|\/$/g, "");
  const [bucket, ...prefix] = dir.split("/");
  const entity = `script-sources/${randomUUID()}.lua`;
  const file = objectStorageClient.bucket(bucket).file([...prefix, entity].join("/"));
  try {
    await file.save(source, { resumable: false, metadata: { contentType: "text/plain; charset=utf-8" } });
    await setObjectAclPolicy(file, { owner: `discord:${creatorId}`, visibility: "private" });
    return `/objects/${entity}`;
  } catch {
    await file.delete({ ignoreNotFound: true }).catch(() => {});
    throw new Error("Private script storage is unavailable. Please try again later.");
  }
}
export async function readScriptSource(path: string) {
  const file = await storage.getObjectEntityFile(path);
  const [body] = await file.download();
  return body.toString("utf8");
}
export async function removeScriptSource(path: string) {
  const file = await storage.getObjectEntityFile(path);
  await file.delete({ ignoreNotFound: true });
}
