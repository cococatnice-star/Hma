import { Client, EmbedBuilder, Team, escapeMarkdown } from "discord.js";

export interface VisitorIpReport {
  ip: string;
  city: string | null;
  state: string | null;
}

let bot: Client | null = null;
let owner: Promise<string> | null = null;

export function bindIpReportBot(client: Client) {
  bot = client;
  owner = null;
}

export function isIpReportBotReady() {
  return Boolean(bot?.isReady());
}

export async function sendPrivateIpReport(report: VisitorIpReport) {
  const client = bot;
  if (!client?.isReady()) throw new Error("Discord bot is unavailable");
  owner ??= client.application.fetch().then(application => {
    const id = application.owner instanceof Team ? application.owner.ownerId : application.owner?.id;
    if (!id) throw new Error("Discord bot owner is unavailable");
    return id;
  }).catch(error => { owner = null; throw error; });
  const recipient = await client.users.fetch(await owner);
  const embed = new EmbedBuilder()
    .setColor(0xff6a00)
    .setTitle("CocoX Sign — consented IP report")
    .setDescription("The visitor explicitly confirmed sharing after seeing four privacy warnings. City/state are IP-based estimates, not GPS.")
    .addFields(
      { name: "IP", value: escapeMarkdown(report.ip) },
      { name: "City", value: escapeMarkdown(report.city || "Not available from IP lookup"), inline: true },
      { name: "State / region", value: escapeMarkdown(report.state || "Not available from IP lookup"), inline: true },
    )
    .setTimestamp();
  // Never use the shop's public purchase channel as a fallback.
  await recipient.send({ embeds: [embed], allowedMentions: { parse: [] } });
}
