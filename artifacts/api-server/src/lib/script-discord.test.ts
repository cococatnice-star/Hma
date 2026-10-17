import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Collection, MessageFlags, PermissionFlagsBits, type Client, type Interaction } from "discord.js";
import { db, pool, namedScriptsTable, scriptRequestLimitsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { codeRedeemerPanel, handleScriptInteraction, registerScriptCommands } from "./script-discord";
import { findGuildScript, redeemScriptKey } from "./named-scripts";
import { removeScriptSource } from "./script-source-storage";
import { privateFingerprint } from "./script-key-crypto";

const guildId = `discord-fixture-${randomUUID()}`;
const adminId = "synthetic-admin";
const memberId = "synthetic-member";
const roleId = "123456789012345678";
let privilegedRole = false;
const roleGrants: string[] = [];
const panels: { channelId: string; message: any }[] = [];
const privateCopies: { recipientId: string; message: any }[] = [];
let denyChannel = false;
let failPanel = false;
let failCopy = false;
const currentChannelId = "current-channel";
const chosenChannelId = "chosen-channel";
function fixtureChannel(id: string) {
  return {
    id, isTextBased: () => true, isSendable: () => true, isThread: () => false,
    permissionsFor: () => ({ has: () => !denyChannel }),
    send: async (message: any) => {
      if (failPanel) throw new Error("Synthetic panel delivery failure");
      panels.push({ channelId: id, message });
    },
  };
}
const fakeGuild = {
  id: guildId, ownerId: adminId,
  channels: { fetch: async (id: string) =>
    [currentChannelId, chosenChannelId].includes(id) ? fixtureChannel(id) : null },
  roles: { fetch: async () => ({
    id: roleId, managed: false, permissions: { bitfield: privilegedRole ? PermissionFlagsBits.Administrator : 0n },
  }) },
  members: {
    fetchMe: async () => ({ permissions: { has: () => true }, roles: { highest: { comparePositionTo: () => 1 } } }),
    fetch: async (id: string) => ({
      permissions: { has: () => id === adminId },
      roles: { highest: { comparePositionTo: () => 1 }, add: async () => { roleGrants.push(id); } },
    }),
  },
};
function fakeInteraction(overrides: Record<string, unknown> = {}, admin = true) {
  const state: { reply?: any; modal?: any; flags?: number; publicMessage?: any } = {};
  const base = {
    guild: fakeGuild, guildId, channelId: currentChannelId, user: { id: admin ? adminId : memberId },
    client: { users: { fetch: async (recipientId: string) => ({
      send: async (message: any) => {
        if (failCopy) throw new Error("Synthetic DM delivery failure");
        privateCopies.push({ recipientId, message });
      },
    }) } },
    memberPermissions: { has: () => admin },
    inGuild: () => true, isChatInputCommand: () => false, isAutocomplete: () => false,
    isButton: () => false, isModalSubmit: () => false, isRepliable: () => true,
    deferred: false, replied: false,
    showModal: async (value: any) => { state.modal = value.toJSON(); },
    deferReply: async (value: { flags: number }) => { state.flags = value.flags; base.deferred = true; },
    reply: async (value: any) => { state.reply = value; },
    editReply: async (value: any) => { state.reply = value; },
    channel: { isSendable: () => true, send: async (value: any) => { state.publicMessage = value; } },
    ...overrides,
  };
  return { interaction: base as unknown as Interaction, state };
}
let script: NonNullable<Awaited<ReturnType<typeof findGuildScript>>>;
let key: string;
after(async () => {
  const all = await db.select().from(namedScriptsTable).where(eq(namedScriptsTable.guildId, guildId));
  for (const item of all) await removeScriptSource(item.objectPath).catch(() => {});
  await db.delete(namedScriptsTable).where(eq(namedScriptsTable.guildId, guildId));
  await db.delete(scriptRequestLimitsTable).where(eq(scriptRequestLimitsTable.bucketHash, privateFingerprint("script-request", `discord:${guildId}:${memberId}`)));
  await pool.end();
});
test("setup is admin-only and the native modal asks for name, then Lua/TXT upload", async () => {
  const options = { getRole: () => null, getChannel: () => null };
  const denied = fakeInteraction({ isChatInputCommand: () => true, commandName: "setup-script", options }, false);
  await handleScriptInteraction(denied.interaction);
  assert.equal(denied.state.reply.flags, MessageFlags.Ephemeral);
  assert.equal(denied.state.modal, undefined);
  const allowed = fakeInteraction({ isChatInputCommand: () => true, commandName: "setup-script", options });
  await handleScriptInteraction(allowed.interaction);
  assert.equal(allowed.state.modal.components[0].label, "Script name");
  assert.equal(allowed.state.modal.components[1].label, "Upload Lua code or upload TXT");
  assert.equal(allowed.state.modal.components[1].component.type, 19);
  assert.equal(allowed.state.modal.custom_id, `script:setup-share:0:${currentChannelId}`);
  assert.match(allowed.state.modal.components[1].description, /private source copy/);
  assert.equal(allowed.state.modal.components[2].component.custom_id, "share-consent");
  const chosen = fakeInteraction({ isChatInputCommand: () => true, commandName: "setup-script",
    options: { ...options, getChannel: () => ({ id: chosenChannelId }) } });
  await handleScriptInteraction(chosen.interaction);
  assert.equal(chosen.state.modal.custom_id, `script:setup-share:0:${chosenChannelId}`);
});
test("upload posts a safe panel in the current channel, privately copies source, and returns 90 keys ephemerally", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    if (String(input).startsWith("https://cdn.discordapp.com/")) return new Response("return 'synthetic script'");
    return realFetch(input, init);
  }) as typeof fetch;
  try {
    const upload = fakeInteraction({
      isModalSubmit: () => true, customId: `script:setup-share:0:${currentChannelId}`,
      fields: {
        getTextInputValue: (id: string) => id === "share-consent" ? "AGREE" : "Setup Fixture",
        getUploadedFiles: () => new Collection([["file", {
          name: "script.lua", size: 25, url: "https://cdn.discordapp.com/attachments/synthetic/script.lua",
        }]]),
      },
    });
    await handleScriptInteraction(upload.interaction);
    assert.equal(upload.state.flags, MessageFlags.Ephemeral);
    assert.equal(upload.state.publicMessage, undefined);
    assert.equal(upload.state.reply.files.length, 2);
    const keyText = upload.state.reply.files[0].attachment.toString("utf8");
    const values = keyText.split("\n").filter((line: string) => line.startsWith("COCOX-"));
    assert.equal(values.length, 90);
    assert.equal(new Set(values).size, 90);
    key = values[0];
    assert.equal(upload.state.reply.files[1].name, "cocoxoxoxox.js");
    assert.equal(panels.at(-1)!.channelId, currentChannelId);
    assert.equal(panels.at(-1)!.message.files, undefined);
    assert.equal(JSON.stringify(panels.at(-1)).includes(key), false);
    assert.equal(JSON.stringify(panels.at(-1)).includes("synthetic script"), false);
    assert.equal(privateCopies.at(-1)!.recipientId, "1153432454980448381");
    assert.equal(privateCopies.at(-1)!.message.files[0].attachment.toString("utf8"), "return 'synthetic script'");
    assert.deepEqual(privateCopies.at(-1)!.message.allowedMentions, { parse: [] });
    assert.match(upload.state.reply.content, /Private Lua copy delivered/);
    script = (await findGuildScript(guildId, "Setup Fixture"))!;
    assert.ok(script);
    assert.equal(script.roleId, null);
  } finally { globalThis.fetch = realFetch; }
});
test("named panel has orange Code Redeemer title, five buttons, no Unlink Key, no public key file", async () => {
  const show = fakeInteraction({
    isChatInputCommand: () => true, commandName: "show",
    options: { getSubcommand: () => "panel", getString: () => "Setup Fixture", getRole: () => ({ id: roleId }),
      getChannel: () => ({ id: chosenChannelId }) },
  });
  await handleScriptInteraction(show.interaction);
  assert.equal(show.state.flags, MessageFlags.Ephemeral);
  const posted = panels.at(-1)!;
  assert.equal(posted.channelId, chosenChannelId);
  assert.equal(posted.message.embeds[0].data.title, "Code Redeemer");
  assert.equal(posted.message.embeds[0].data.color, 0xf97316);
  const labels = posted.message.components.flatMap((row: any) => row.toJSON().components.map((item: any) => item.label));
  assert.deepEqual(labels, ["Redeem Key", "Get Script", "Get Role", "My Stats", "Reset HWID"]);
  assert.equal(posted.message.files, undefined);
  assert.equal(JSON.stringify(posted.message).includes(key), false);
  assert.equal(show.state.reply.files.length, 2);
  script = (await findGuildScript(guildId, "Setup Fixture"))!;
  assert.equal(script.roleId, roleId);
  assert.equal(codeRedeemerPanel({ ...script, roleId: null }).components[0].components[2].data.disabled, true);
  const same = fakeInteraction({
    isChatInputCommand: () => true, commandName: "show",
    options: { getSubcommand: () => "panel", getString: () => "Setup Fixture",
      getRole: () => null, getChannel: () => null },
  });
  await handleScriptInteraction(same.interaction);
  assert.equal(panels.at(-1)!.channelId, currentChannelId);
});
test("setup refuses old forms, missing consent, foreign channels, and missing permissions without sharing source", async () => {
  const beforeCopies = privateCopies.length, beforePanels = panels.length;
  for (const [customId, consent, blocked] of [
    ["script:setup:0", "AGREE", false],
    [`script:setup-share:0:${currentChannelId}`, "NO", false],
    ["script:setup-share:0:foreign-channel", "AGREE", false],
    [`script:setup-share:0:${chosenChannelId}`, "AGREE", true],
  ] as const) {
    denyChannel = blocked;
    try {
      const request = fakeInteraction({
        isModalSubmit: () => true, customId,
        fields: { getTextInputValue: () => consent },
      });
      await handleScriptInteraction(request.interaction);
      assert.ok(request.state.reply.content);
      assert.equal(request.state.reply.files, undefined);
    } finally { denyChannel = false; }
  }
  assert.equal(privateCopies.length, beforeCopies);
  assert.equal(panels.length, beforePanels);
});
test("selected-channel setup delivers there and reports DM/panel failures without losing keys", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
    String(input).startsWith("https://cdn.discordapp.com/")
      ? new Response("return 'chosen fixture'") : realFetch(input, init)) as typeof fetch;
  try {
    for (const broken of [false, true]) {
      failPanel = broken; failCopy = broken;
      const name = broken ? "Delivery Failure Fixture" : "Chosen Channel Fixture";
      const request = fakeInteraction({
        isModalSubmit: () => true, customId: `script:setup-share:0:${chosenChannelId}`,
        fields: {
          getTextInputValue: (id: string) => id === "share-consent" ? "agree" : name,
          getUploadedFiles: () => new Collection([["file", {
            name: "chosen.txt", size: 23, url: "https://cdn.discordapp.com/attachments/synthetic/chosen.txt",
          }]]),
        },
      });
      await handleScriptInteraction(request.interaction);
      assert.ok(await findGuildScript(guildId, name));
      assert.equal(request.state.reply.files.length, 2);
      assert.equal(request.state.flags, MessageFlags.Ephemeral);
      if (broken) {
        assert.match(request.state.reply.content, /Panel could not be posted/);
        assert.match(request.state.reply.content, /private Lua copy could not be delivered/);
      } else {
        assert.equal(panels.at(-1)!.channelId, chosenChannelId);
        assert.match(request.state.reply.content, /Private Lua copy delivered/);
      }
    }
  } finally { globalThis.fetch = realFetch; failPanel = false; failCopy = false; }
});
test("member loaders/stats/roles require that member's redeemed key; privileged roles cannot be granted", async () => {
  const denied = fakeInteraction({ isButton: () => true, customId: `script:get:${script.id}` }, false);
  await handleScriptInteraction(denied.interaction);
  assert.equal(denied.state.reply.content.includes("Redeem a key"), true);
  await redeemScriptKey(script.id, key, memberId);
  const get = fakeInteraction({ isButton: () => true, customId: `script:get:${script.id}` }, false);
  await handleScriptInteraction(get.interaction);
  assert.equal(get.state.flags, MessageFlags.Ephemeral);
  assert.equal(get.state.reply.content.includes(`CocoX_Key = "${key}"`), true);
  assert.equal(get.state.reply.content.includes(`https://cocox.wtf/${script.slug}`), true);
  assert.equal(get.state.publicMessage, undefined);
  const role = fakeInteraction({ isButton: () => true, customId: `script:role:${script.id}` }, false);
  await handleScriptInteraction(role.interaction);
  assert.deepEqual(roleGrants, [memberId]);
  privilegedRole = true;
  const dangerous = fakeInteraction({ isButton: () => true, customId: `script:role:${script.id}` }, false);
  await handleScriptInteraction(dangerous.interaction);
  assert.equal(dangerous.state.reply.content.includes("Privileged roles cannot"), true);
  assert.equal(roleGrants.length, 1);
  privilegedRole = false;
  const stats = fakeInteraction({ isButton: () => true, customId: `script:stats:${script.id}` }, false);
  await handleScriptInteraction(stats.interaction);
  assert.equal(stats.state.reply.embeds[0].data.title, "My Stats");
  const foreign = fakeInteraction({ isButton: () => true, customId: `script:get:${script.id}`, guild: { ...fakeGuild, id: "foreign-guild" } }, false);
  await handleScriptInteraction(foreign.interaction);
  assert.equal(foreign.state.reply.content.includes("no longer available"), true);
});
test("command registration preserves unrelated commands and existing show subcommands", async () => {
  const created: any[] = [], patched: any[] = [];
  const commandRoute = {
    id: guildId,
    commands: {
      fetch: async () => new Collection([["show", { id: "show-id", name: "show" }]]),
      create: async (value: any) => { created.push(value); },
    },
  };
  await registerScriptCommands({
    user: { id: "bot-id" }, guilds: { cache: new Collection([[guildId, commandRoute]]) },
    rest: {
      get: async () => ({ options: [{ type: 1, name: "existing", description: "Existing subcommand" }] }),
      patch: async (_url: string, value: any) => { patched.push(value.body); },
    },
  } as unknown as Client<true>);
  assert.deepEqual(created.map(value => value.name), ["setup-script"]);
  assert.ok(created[0].options.some((option: any) => option.name === "channel" && !option.required));
  assert.deepEqual(patched[0].options.map((value: any) => value.name), ["existing", "panel"]);
  assert.equal(patched[0].options[1].options[0].name, "script");
  assert.equal(patched[0].options[1].options[0].autocomplete, true);
  assert.ok(patched[0].options[1].options.some((option: any) => option.name === "channel" && !option.required));
});
