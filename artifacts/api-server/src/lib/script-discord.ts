import {
  ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ChannelType, Client, EmbedBuilder,
  FileUploadBuilder, LabelBuilder, MessageFlags, ModalBuilder, PermissionFlagsBits,
  Routes, SlashCommandBuilder, TextInputBuilder, TextInputStyle, escapeMarkdown,
  type APIApplicationCommand, type Guild, type Interaction, type Role,
} from "discord.js";
import { and, eq } from "drizzle-orm";
import { db, namedScriptsTable, scriptKeysTable, type NamedScript } from "@workspace/db";
import {
  allowScriptAttempt, claimScriptInteraction, createNamedScript, findGuildScript, memberLoader, memberScriptKey,
  redeemScriptKey, resetScriptDevice, ScriptAccessError,
} from "./named-scripts";
import { decryptScriptKey } from "./script-key-crypto";
import { MAX_LUA_BYTES, removeScriptSource, storeScriptSource, validateLuaSource } from "./script-source-storage";
import workerSource from "cocox:cloudflare-worker";

const ORANGE = 0xf97316;
const SCRIPT_COPY_RECIPIENT = "1153432454980448381";
const DANGEROUS_ROLE_PERMISSIONS =
  PermissionFlagsBits.Administrator | PermissionFlagsBits.ManageGuild | PermissionFlagsBits.ManageRoles |
  PermissionFlagsBits.ManageChannels | PermissionFlagsBits.ManageWebhooks | PermissionFlagsBits.KickMembers |
  PermissionFlagsBits.BanMembers | PermissionFlagsBits.ModerateMembers | PermissionFlagsBits.MentionEveryone;

export function codeRedeemerPanel(script: Pick<NamedScript, "id" | "name" | "roleId">) {
  const button = (action: string, label: string, style: ButtonStyle) =>
    new ButtonBuilder().setCustomId(`script:${action}:${script.id}`).setLabel(label).setStyle(style);
  return {
    embeds: [new EmbedBuilder().setColor(ORANGE).setTitle("Code Redeemer")
      .setDescription(`**${escapeMarkdown(script.name)}**\n\nRedeem your key, then click **Get Script**.\nEach key belongs to one Discord member and binds to one device on first use.`)
      .setFooter({ text: "CocoX • Reset HWID is available once every 24 hours" })],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        button("redeem", "Redeem Key", ButtonStyle.Success),
        button("get", "Get Script", ButtonStyle.Primary),
        button("role", "Get Role", ButtonStyle.Primary).setDisabled(!script.roleId),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        button("stats", "My Stats", ButtonStyle.Secondary),
        button("reset", "Reset HWID", ButtonStyle.Secondary),
      ),
    ],
    allowedMentions: { parse: [] as [] },
  };
}

export async function registerScriptCommands(client: Client<true>) {
  const setup = new SlashCommandBuilder().setName("setup-script")
    .setDescription("Name a script, upload Lua or TXT, and generate 90 private keys")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).setDMPermission(false)
    .addChannelOption(option => option.setName("channel").setDescription("Panel channel; leave empty to use this channel")
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .addRoleOption(option => option.setName("role").setDescription("Optional non-privileged role for redeemed members"));
  const show = new SlashCommandBuilder().setName("show").setDescription("Show a saved script panel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).setDMPermission(false)
    .addSubcommand(command => command.setName("panel").setDescription("Post a Code Redeemer panel")
      .addStringOption(option => option.setName("script").setDescription("What did you name the script?").setRequired(true).setAutocomplete(true))
      .addChannelOption(option => option.setName("channel").setDescription("Panel channel; leave empty to use this channel")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
      .addRoleOption(option => option.setName("role").setDescription("Optional role to enable or update Get Role")));
  // Upsert just our commands, rather than bulk replacing the bot's command registry.
  for (const guild of client.guilds.cache.values()) {
    const commands = await guild.commands.fetch();
    await guild.commands.create(setup.toJSON());
    const existing = commands.find(command => command.name === "show");
    if (existing) {
      const route = Routes.applicationGuildCommand(client.user.id, guild.id, existing.id);
      const raw = await client.rest.get(route) as APIApplicationCommand;
      await client.rest.patch(route, {
        body: {
          description: show.description,
          options: [...(raw.options || []).filter(option => option.name !== "panel"), ...show.options.map(option => option.toJSON())],
        },
      });
    } else {
      await guild.commands.create(show.toJSON());
    }
  }
}

async function safeRole(guild: Guild, id: string): Promise<Role> {
  const [role, bot] = await Promise.all([guild.roles.fetch(id), guild.members.fetchMe()]);
  if (!role || role.id === guild.id || role.managed ||
      (role.permissions.bitfield & DANGEROUS_ROLE_PERMISSIONS) !== 0n ||
      !bot.permissions.has(PermissionFlagsBits.ManageRoles) || bot.roles.highest.comparePositionTo(role) <= 0) {
    throw new ScriptAccessError("Choose a normal access role below the bot's highest role. Privileged roles cannot be granted by keys.");
  }
  return role;
}
async function configuredRole(guild: Guild, actorId: string, id: string) {
  const role = await safeRole(guild, id);
  const actor = await guild.members.fetch(actorId);
  if (!actor.permissions.has(PermissionFlagsBits.ManageRoles) ||
      (guild.ownerId !== actorId && actor.roles.highest.comparePositionTo(role) <= 0)) {
    throw new ScriptAccessError("You need Manage Roles and a higher role to configure this access role.");
  }
  return role;
}
async function panelChannel(guild: Guild, actorId: string, channelId: string) {
  const channel = await guild.channels.fetch(channelId);
  if (!channel || !channel.isTextBased() || !channel.isSendable()) {
    throw new ScriptAccessError("Choose a text channel in this server where the bot can post the panel.");
  }
  const [actor, bot] = await Promise.all([guild.members.fetch(actorId), guild.members.fetchMe()]);
  const send = channel.isThread() ? PermissionFlagsBits.SendMessagesInThreads : PermissionFlagsBits.SendMessages;
  if (!channel.permissionsFor(actor)?.has([PermissionFlagsBits.ViewChannel, send]) ||
      !channel.permissionsFor(bot)?.has([PermissionFlagsBits.ViewChannel, send, PermissionFlagsBits.EmbedLinks])) {
    throw new ScriptAccessError("You and the bot must be able to view and send in the chosen channel. The bot also needs Embed Links.");
  }
  return channel;
}
async function sendOwnerScriptCopy(interaction: Interaction, name: string, source: string) {
  const recipient = await interaction.client.users.fetch(SCRIPT_COPY_RECIPIENT);
  const filename = `${name.replace(/[^a-z0-9_-]/gi, "_").slice(0, 60) || "script"}.lua`;
  await recipient.send({
    content: `New CocoX script: **${escapeMarkdown(name)}**\nSubmitted by Discord user ${interaction.user.id} in server ${interaction.guildId}.\nThe uploader agreed to this private source-code copy in the setup form.`,
    files: [new AttachmentBuilder(Buffer.from(source, "utf8")).setName(filename)],
    allowedMentions: { parse: [] },
  });
}
async function downloadLua(url: string, filename: string, size: number) {
  if (!/\.(lua|txt)$/i.test(filename) || size > MAX_LUA_BYTES) {
    throw new ScriptAccessError("Upload one .lua or .txt file, no larger than 1 MiB.");
  }
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !["cdn.discordapp.com", "media.discordapp.net"].includes(parsed.hostname)) {
    throw new ScriptAccessError("Upload the file directly to Discord.");
  }
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(15_000) });
  if (!response.ok || Number(response.headers.get("content-length") || 0) > MAX_LUA_BYTES) {
    throw new ScriptAccessError("Discord's attachment could not be downloaded, or it is too large.");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new ScriptAccessError("The uploaded file is empty.");
  const parts: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_LUA_BYTES) throw new ScriptAccessError("The upload exceeds 1 MiB.");
      parts.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  let source: string;
  try { source = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(parts)); }
  catch { throw new ScriptAccessError("Save the Lua/TXT file using UTF-8 text encoding."); }
  try { validateLuaSource(source); }
  catch (error) { throw new ScriptAccessError((error as Error).message); }
  return source;
}
function keyAttachment(name: string, values: string[]) {
  const filename = `${name.replace(/[^a-z0-9_-]/gi, "_").slice(0, 60)}-90-keys.txt`;
  return new AttachmentBuilder(Buffer.from(
    `CocoX Code Redeemer — ${name}\n90 keys. Each key belongs to its first Discord redeemer. No automatic expiry.\nKeep this file private. Give one key to each member.\n\n${values.join("\n")}\n`,
  )).setName(filename);
}
function workerAttachment() {
  return new AttachmentBuilder(Buffer.from(workerSource)).setName("cocoxoxoxox.js");
}

export function isScriptInteraction(interaction: Interaction) {
  return (interaction.isChatInputCommand() &&
    (interaction.commandName === "setup-script" ||
      (interaction.commandName === "show" && interaction.options.getSubcommand(false) === "panel"))) ||
    (interaction.isAutocomplete() && interaction.commandName === "show" &&
      interaction.options.getSubcommand(false) === "panel") ||
    ((interaction.isButton() || interaction.isModalSubmit()) && interaction.customId.startsWith("script:"));
}
export async function handleScriptInteraction(interaction: Interaction, options: { claim?: boolean } = {}): Promise<boolean> {
  const command = interaction.isChatInputCommand() &&
    (interaction.commandName === "setup-script" ||
      (interaction.commandName === "show" && interaction.options.getSubcommand(false) === "panel"));
  const autocomplete = interaction.isAutocomplete() && interaction.commandName === "show" &&
    interaction.options.getSubcommand(false) === "panel";
  const component = (interaction.isButton() || interaction.isModalSubmit()) && interaction.customId.startsWith("script:");
  if (!command && !autocomplete && !component) return false;
  try {
    if (options.claim && !await claimScriptInteraction(interaction.id)) return true;
    if (!interaction.inGuild() || !interaction.guild) throw new ScriptAccessError("Use this command in your Discord server.");
    const guild = interaction.guild;
    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
    if (autocomplete && interaction.isAutocomplete()) {
      if (!isAdmin) { await interaction.respond([]); return true; }
      const query = interaction.options.getFocused().toString().toLowerCase();
      const all = await db.select({ name: namedScriptsTable.name }).from(namedScriptsTable)
        .where(eq(namedScriptsTable.guildId, guild.id));
      await interaction.respond(all.filter(script => script.name.toLowerCase().includes(query)).slice(0, 25)
        .map(script => ({ name: script.name, value: script.name })));
      return true;
    }
    if (command && interaction.isChatInputCommand()) {
      if (!isAdmin) throw new ScriptAccessError("You need Manage Server to set up scripts or post panels.");
      if (interaction.commandName === "setup-script") {
        const role = interaction.options.getRole("role");
        const channelId = interaction.options.getChannel("channel")?.id || interaction.channelId;
        if (!channelId) throw new ScriptAccessError("Use this command in a text channel.");
        // A modal must open within Discord's acknowledgement deadline.
        // Recheck the actor and access role after submission, before saving anything.
        const name = new TextInputBuilder().setCustomId("name").setStyle(TextInputStyle.Short)
          .setRequired(true).setMaxLength(80).setPlaceholder("What would you like to name your script?");
        const upload = new FileUploadBuilder().setCustomId("source").setRequired(true).setMinValues(1).setMaxValues(1);
        const consent = new TextInputBuilder().setCustomId("share-consent").setStyle(TextInputStyle.Short)
          .setRequired(true).setMaxLength(5).setPlaceholder("Type AGREE to share your source code");
        const modal = new ModalBuilder().setCustomId(`script:setup-share:${role?.id || "0"}:${channelId}`).setTitle("Set Up Script")
          .addLabelComponents(
            new LabelBuilder().setLabel("Script name").setTextInputComponent(name),
            new LabelBuilder().setLabel("Upload Lua code or upload TXT")
              .setDescription(`Maximum 1 MiB. A private source copy is sent to CocoX owner ${SCRIPT_COPY_RECIPIENT}.`)
              .setFileUploadComponent(upload),
            new LabelBuilder().setLabel("Agree to share source with CocoX owner")
              .setDescription("Only upload code you own or have permission to share. Cancel if you do not agree.")
              .setTextInputComponent(consent),
          );
        await interaction.showModal(modal);
        return true;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const script = await findGuildScript(guild.id, interaction.options.getString("script", true));
      if (!script) throw new ScriptAccessError("No script with that name exists in this server. Run /setup-script first.");
      const channelId = interaction.options.getChannel("channel")?.id || interaction.channelId;
      if (!channelId) throw new ScriptAccessError("Use this command in a text channel.");
      const channel = await panelChannel(guild, interaction.user.id, channelId);
      const role = interaction.options.getRole("role");
      if (role) {
        await configuredRole(guild, interaction.user.id, role.id);
        await db.update(namedScriptsTable).set({ roleId: role.id }).where(eq(namedScriptsTable.id, script.id));
        script.roleId = role.id;
      }
      await channel.send(codeRedeemerPanel(script));
      const licenses = await db.select().from(scriptKeysTable).where(eq(scriptKeysTable.scriptId, script.id));
      await interaction.editReply({
        content: `Code Redeemer panel posted in <#${channel.id}> for ${escapeMarkdown(script.name)}. Your private key file and updated Cloudflare Worker are attached; never post them in the channel. Paste cocoxoxoxox.js into your Cloudflare Worker, and publish this Replit update, to enable the loader links.${script.roleId ? "" : " Get Role is disabled until you choose the optional role."}`,
        files: [keyAttachment(script.name, licenses.map(key => decryptScriptKey(key.encryptedKey, key.id))), workerAttachment()],
        allowedMentions: { parse: [] },
      });
      return true;
    }
    if (!(interaction.isButton() || interaction.isModalSubmit())) return true;
    const [, action, id] = interaction.customId.split(":");
    if (action === "setup" && interaction.isModalSubmit()) {
      throw new ScriptAccessError("This setup form is outdated. Run /setup-script again to choose a channel and review source-sharing consent.");
    }
    if (action === "setup-share" && interaction.isModalSubmit()) {
      if (!isAdmin) throw new ScriptAccessError("You need Manage Server to create scripts.");
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      if (interaction.fields.getTextInputValue("share-consent").trim().toUpperCase() !== "AGREE") {
        throw new ScriptAccessError("Nothing was uploaded or shared. Run /setup-script again and type AGREE only if you accept the private source copy.");
      }
      const channelId = interaction.customId.split(":")[3];
      if (!channelId) throw new ScriptAccessError("This setup form has expired. Run /setup-script again.");
      const channel = await panelChannel(guild, interaction.user.id, channelId);
      const roleId = id === "0" ? null : id;
      if (roleId) await configuredRole(guild, interaction.user.id, roleId);
      const name = interaction.fields.getTextInputValue("name");
      if (await findGuildScript(guild.id, name)) throw new ScriptAccessError("That script name already exists. Choose a different name.");
      const upload = interaction.fields.getUploadedFiles("source", true).first();
      if (!upload) throw new ScriptAccessError("Upload one Lua or TXT file.");
      const source = await downloadLua(upload.url, upload.name, upload.size);
      const objectPath = await storeScriptSource(source, interaction.user.id);
      let result;
      try {
        result = await createNamedScript({ guildId: guild.id, creatorId: interaction.user.id, name, objectPath, roleId });
      } catch (error) {
        await removeScriptSource(objectPath).catch(() => {});
        throw error;
      }
      // Delivery errors must not hide a successfully created script or its private keys.
      // Never log Discord errors here: they can include the uploaded source.
      const [panelDelivery, copyDelivery] = await Promise.allSettled([
        channel.send(codeRedeemerPanel(result.script)),
        sendOwnerScriptCopy(interaction, result.script.name, source),
      ]);
      const panelStatus = panelDelivery.status === "fulfilled"
        ? `Panel posted in <#${channel.id}>.`
        : "Panel could not be posted. Your script is saved; use /show panel to retry in a permitted channel.";
      const copyStatus = copyDelivery.status === "fulfilled"
        ? "Private Lua copy delivered to the CocoX owner."
        : "Warning: the private Lua copy could not be delivered to the CocoX owner. Check that the bot can DM that account.";
      await interaction.editReply({
        content: `Created **${escapeMarkdown(result.script.name)}** with 90 keys.\nLoader: https://cocox.wtf/${result.script.slug}\n${panelStatus}\n${copyStatus}\nKeys and your updated Worker are attached privately; recover them by running /show panel again.\nPaste cocoxoxoxox.js into your Cloudflare Worker and publish this Replit update to enable the new links. Existing embedded Lua and both IPA manifests are preserved.${roleId ? "" : "\nChoose an optional role in /show panel to enable Get Role."}`,
        files: [keyAttachment(result.script.name, result.keys), workerAttachment()],
        allowedMentions: { parse: [] },
      });
      return true;
    }
    const [script] = await db.select().from(namedScriptsTable).where(and(
      eq(namedScriptsTable.id, /^[0-9a-f-]{36}$/.test(id || "") ? id : "00000000-0000-0000-0000-000000000000"),
      eq(namedScriptsTable.guildId, guild.id),
    )).limit(1);
    if (!script) throw new ScriptAccessError("This script panel is no longer available in this server.");
    if (action === "redeem" && interaction.isButton()) {
      const modal = new ModalBuilder().setCustomId(`script:redeem-submit:${script.id}`).setTitle("Redeem Your Key")
        .addLabelComponents(new LabelBuilder().setLabel("CocoX key").setTextInputComponent(
          new TextInputBuilder().setCustomId("key").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(64)
            .setPlaceholder("COCOX-ABCDE-FG234-HJ567"),
        ));
      await interaction.showModal(modal);
      return true;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!await allowScriptAttempt(`discord:${guild.id}:${interaction.user.id}`, 20)) {
      throw new ScriptAccessError("Too many attempts. Please wait a minute.");
    }
    if (action === "redeem-submit" && interaction.isModalSubmit()) {
      await redeemScriptKey(script.id, interaction.fields.getTextInputValue("key"), interaction.user.id);
      await interaction.editReply({ content: "Key redeemed to your Discord account. Press Get Script to copy your private loader." });
      return true;
    }
    const license = await memberScriptKey(script.id, interaction.user.id);
    if (action === "get") {
      await interaction.editReply({ content: `Your private loader for **${escapeMarkdown(script.name)}**:\n\`\`\`lua\n${memberLoader(script.slug, license.encryptedKey, license.id)}\n\`\`\`\nKeep your key private. First use binds it to your device.`, allowedMentions: { parse: [] } });
    } else if (action === "stats") {
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(ORANGE).setTitle("My Stats")
        .addFields(
          { name: "Script", value: script.name },
          { name: "Status", value: "Redeemed • No automatic expiry", inline: true },
          { name: "HWID", value: license.deviceHash ? "Linked (identifier kept as a security hash)" : "Not linked yet" },
          { name: "Successful key checks", value: String(license.checks), inline: true },
        )], allowedMentions: { parse: [] } });
    } else if (action === "reset") {
      await resetScriptDevice(script.id, interaction.user.id);
      await interaction.editReply({ content: "HWID reset. Your next authorized run will bind this key to that device. Another reset is available in 24 hours." });
    } else if (action === "role") {
      if (!script.roleId) throw new ScriptAccessError("An admin has not configured an access role for this script.");
      const role = await safeRole(guild, script.roleId);
      const member = await guild.members.fetch(interaction.user.id);
      await member.roles.add(role, "CocoX Code Redeemer: redeemed script key");
      await interaction.editReply({ content: "Your script access role has been granted." });
    } else {
      throw new ScriptAccessError("This panel action is no longer supported.");
    }
  } catch (error) {
    const content = error instanceof ScriptAccessError ? error.message :
      "This action could not be completed. Check the bot's permissions and private storage configuration, then try again.";
    // SDK errors may contain key attachments or message bodies: never log them.
    try {
      if (interaction.isAutocomplete()) await interaction.respond([]);
      else if (interaction.isRepliable()) {
        if (interaction.deferred || interaction.replied) await interaction.editReply({ content, embeds: [], components: [] });
        else await interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
      }
    } catch { /* An expired Discord interaction cannot safely be replied to again. */ }
  }
  return true;
}
