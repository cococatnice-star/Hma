import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  ModalBuilder,
  Partials,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ModalSubmitInteraction,
  type Interaction,
  type TextChannel,
} from "discord.js";
import { products } from "@workspace/store-catalog";
import { logger } from "./logger";
import { bindIpReportBot } from "./ip-discord";
import { handleScriptInteraction, isScriptInteraction, registerScriptCommands } from "./script-discord";

const PURCHASE_CHANNEL_ID =
  process.env.DISCORD_PURCHASE_CHANNEL_ID ?? "1547359411402448896";
const CHECK_INTERVAL_MS = 10_000;
const MAX_CHECKS = 60;
const CURRENT_PANEL_FOOTER = "CocoX / Moza Scripts • MeowCheatz Store";

const COCOX_GAMEPASS_ID = 1975436279;
const COCOX_GAMEPASS_URL = "https://www.roblox.com/game-pass/1975436279/CocoX";

const MOZA_GAMEPASS_ID = 1979852276;
const MOZA_GAMEPASS_URL = "https://www.roblox.com/game-pass/1979852276/Moza";

type StoreItem = {
  id: string;
  name: string;
  websiteProductId: string;
  websitePrice: string;
  available: boolean;
  assetId?: number;
};

const storeItems: StoreItem[] = products.flatMap((product) =>
  product.variants.map((variant, variantIndex) => ({
    id: `${product.id}:${variantIndex}`,
    name: variant.name,
    websiteProductId: product.id,
    websitePrice: `$${variant.price.toFixed(2)}`,
    available: variant.inStock === undefined || variant.inStock > 0,
    assetId: readAssetId(`${toEnvironmentKey(product.id)}_${variantIndex + 1}`),
  })),
);

const activeChecks = new Map<string, ReturnType<typeof setInterval>>();
const legacyItemIds = new Map<string, string>([
  ["volt-executor:0", "cocox-scripts:0"],
  ["volt-executor:1", "cocox-scripts:1"],
  ["volt-executor:2", "cocox-scripts:2"],
  ["synapse-z:0", "moza-scripts:0"],
  ["synapse-z:1", "moza-scripts:1"],
  ["volt-farmer:0", "cocox-scripts:0"],
  ["volt-7-day", "cocox-scripts:0"],
  ["volt-30-day", "cocox-scripts:1"],
  ["volt-90-day", "cocox-scripts:2"],
  ["synapse-z-7-day", "moza-scripts:0"],
  ["synapse-z-30-day", "moza-scripts:1"],
]);

function readAssetId(key: string): number | undefined {
  const value = process.env[`ROBLOX_ASSET_ID_${key}`];
  if (!value) return undefined;

  const assetId = Number(value);
  return Number.isInteger(assetId) && assetId > 0 ? assetId : undefined;
}

function toEnvironmentKey(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, "_").toUpperCase();
}

function findItem(id: string): StoreItem | undefined {
  const currentId = legacyItemIds.get(id) ?? id;
  return storeItems.find((item) => item.id === currentId);
}

function purchasePanelComponents() {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("purchase:start:v2")
        .setLabel("Start Purchase")
        .setEmoji("🛒")
        .setStyle(ButtonStyle.Primary),
    ),
  ];
}

function purchasePanelEmbed() {
  const availableItems = storeItems
    .filter((item) => item.available)
    .map((item) => `• ${item.name} — ${item.websitePrice}`)
    .join("\n");

  return new EmbedBuilder()
    .setColor(0xff3b30)
    .setTitle("🛒 CocoX / Moza Scripts Store")
    .setDescription(
      "Click the button below to start your purchase.\nYou will be guided through the CocoX Scripts or Moza Scripts purchase process step by step.",
    )
    .addFields({ name: "Available catalog", value: availableItems })
    .setFooter({ text: CURRENT_PANEL_FOOTER })
    .setTimestamp();
}

function itemSelectComponents() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("purchase:item:v2")
    .setPlaceholder("Select an available item");

  for (const item of storeItems.filter((candidate) => candidate.available)) {
    menu.addOptions({
      label: item.name,
      value: item.id,
      description: `${item.websitePrice} • Available on website`,
    });
  }

  return [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)];
}

function outdatedPurchasePanelEmbed() {
  return new EmbedBuilder()
    .setColor(0x6b7280)
    .setTitle("⚠️ Outdated Purchase Panel")
    .setDescription(
      "This executor menu is no longer active. Use the new **CocoX / Moza Scripts** panel below.",
    )
    .setFooter({ text: CURRENT_PANEL_FOOTER })
    .setTimestamp();
}

function itemPurchaseComponents(item: StoreItem) {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  if (item.assetId) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel("Click here to buy the shirt")
          .setStyle(ButtonStyle.Link)
          .setURL(`https://www.roblox.com/catalog/${item.assetId}`),
      ),
    );
  }

  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`purchase:buy:${item.id}`)
        .setLabel("Purchase")
        .setEmoji("🛒")
        .setStyle(ButtonStyle.Success),
      ...(item.assetId
        ? [
            new ButtonBuilder()
              .setCustomId(`purchase:verify:${item.id}`)
              .setLabel("Check Purchase")
              .setEmoji("🔄")
              .setStyle(ButtonStyle.Secondary),
          ]
        : []),
    ),
  );

  return rows;
}

function itemDetailsEmbed(item: StoreItem) {
  const available = item.available;
  return new EmbedBuilder()
    .setColor(available ? 0x00e5ff : 0xffb000)
    .setTitle("🛒 Complete Your Purchase")
    .setDescription(
      !available
        ? "This item is currently out of stock on the website."
        : item.assetId
          ? "Please purchase the payment shirt below to complete your order.\n\nAfter purchasing, press **Check Purchase**. I will automatically check your Roblox account every 20 seconds."
          : "This item is available on the website. Press **Purchase** to continue in your DMs. Automatic Roblox verification will activate after its payment item ID is configured.",
    )
    .addFields(
      { name: "🛒 Product", value: item.name, inline: true },
      { name: "💰 Price", value: item.websitePrice, inline: true },
      {
        name: "⏱️ Checks",
        value: !available
          ? "Unavailable"
          : item.assetId
            ? "Every 20 seconds"
            : "Pending item setup",
        inline: true,
      },
    )
    .setFooter({ text: "MeowCheatz Store" })
    .setTimestamp();
}

function itemDmEmbed(item: StoreItem, username?: string) {
  return new EmbedBuilder()
    .setColor(0x00e5ff)
    .setTitle("🛒 Complete Your Purchase")
    .setDescription(
      `${item.assetId ? "Please purchase the payment shirt below to complete your order." : "Your website item is reserved for this purchase flow. The Roblox payment item is still being configured."}\n\n${item.assetId ? "After purchasing, the bot will automatically detect it. You do not need to do anything else." : "Automatic Roblox purchase detection will activate when the payment item ID is configured."}${username ? `\n\nRoblox username: **${username}**` : ""}`,
    )
    .addFields(
      { name: "🛒 Product", value: item.name, inline: true },
      { name: "💰 Price", value: item.websitePrice, inline: true },
      {
        name: "🔄 Checking",
        value: item.assetId ? "Every 20 seconds" : "Pending item setup",
        inline: true,
      },
    )
    .setFooter({
      text: "Your key will be delivered here after payment is detected.",
    })
    .setTimestamp();
}

async function resolveRobloxUserId(
  username: string,
): Promise<number | undefined> {
  const response = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      usernames: [username],
      excludeBannedUsers: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Roblox username lookup failed with ${response.status}`);
  }

  const body = (await response.json()) as {
    data?: Array<{ id: number }>;
  };
  return body.data?.[0]?.id;
}

function generateTicketCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let random = "";

  for (let i = 0; i < 10; i++) {
    random += chars[Math.floor(Math.random() * chars.length)];
  }

  return `CocoX-${random}`;
}

async function ownsCocoXGamePass(userId: number): Promise<boolean> {
  const response = await fetch(
    `https://inventory.roblox.com/v1/users/${userId}/items/gamepass/${COCOX_GAMEPASS_ID}/is-owned`,
  );

  if (!response.ok) {
    throw new Error(
      `Roblox gamepass ownership check failed with ${response.status}`,
    );
  }

  const body = (await response.json()) as boolean | { isOwned?: boolean };
  return typeof body === "boolean" ? body : body.isOwned === true;
}

function cocoXPurchaseDmEmbed(username: string) {
  return new EmbedBuilder()
    .setColor(0x00e5ff)
    .setTitle("🛒 Complete Your Purchase")
    .setDescription(
      `Please purchase the **CocoX Roblox Gamepass** below to complete your order.\n\n` +
        `I will automatically check **${username}** every **10 seconds** to see if the gamepass has been purchased.`,
    )
    .addFields(
      {
        name: "🛒 Product",
        value: "CocoX",
        inline: true,
      },
      {
        name: "💰 Payment",
        value: "Roblox Gamepass",
        inline: true,
      },
      {
        name: "🔄 Checking",
        value: "Every 10 seconds",
        inline: true,
      },
    )
    .setFooter({
      text: "Your purchase will be automatically detected.",
    })
    .setTimestamp();
}

function cocoXPurchaseDmComponents() {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("Purchase CocoX")
        .setStyle(ButtonStyle.Link)
        .setURL(COCOX_GAMEPASS_URL),
    ),
  ];
}

async function sendVerifiedTicket(
  username: string,
  user: {
    send: (
      payload:
        | string
        | {
            embeds: EmbedBuilder[];
          },
    ) => Promise<unknown>;
  },
) {
  const ticketCode = generateTicketCode();

  await user.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0x22c55e)
        .setTitle("✅ Purchase Detected!")
        .setDescription(
          `Your purchase of **CocoX** has been detected successfully!\n\n` +
            `Roblox Username: **${username}**\n\n` +
            `Ticket Code:\n**${ticketCode}**\n\n` +
            `📸 **Take a screenshot of this message and make a ticket.**\n\n` +
            `When you create the ticket, send the screenshot so your purchase can be verified.`,
        )
        .addFields({
          name: "🎫 Ticket",
          value: ticketCode,
          inline: false,
        })
        .setFooter({
          text: "CocoX Purchase Verification",
        })
        .setTimestamp(),
    ],
  });
}

async function monitorCocoXGamePass(
  discordUserId: string,
  robloxUserId: number,
  username: string,
  user: {
    send: (
      payload:
        | string
        | {
            embeds: EmbedBuilder[];
          },
    ) => Promise<unknown>;
  },
) {
  const checkKey = `${discordUserId}:cocox-gamepass`;
  const current = activeChecks.get(checkKey);

  if (current) {
    clearInterval(current);
  }

  let checks = 0;

  const timer = setInterval(async () => {
    checks += 1;

    try {
      const ownsPass = await ownsCocoXGamePass(robloxUserId);

      if (ownsPass) {
        clearInterval(timer);
        activeChecks.delete(checkKey);

        await sendVerifiedTicket(username, user);
        return;
      }
    } catch (error) {
      logger.warn(
        {
          err: error,
          robloxUserId,
          gamePassId: COCOX_GAMEPASS_ID,
        },
        "Roblox gamepass check failed",
      );
    }

    if (checks >= MAX_CHECKS) {
      clearInterval(timer);
      activeChecks.delete(checkKey);

      await user.send(
        `I could not detect the CocoX gamepass within 10 minutes.\n\n` +
          `If you already bought it, press **Start Purchase** again and re-enter your Roblox username.\n\n` +
          `${COCOX_GAMEPASS_URL}`,
      );
    }
  }, CHECK_INTERVAL_MS);

  activeChecks.set(checkKey, timer);
}

async function handleCocoXGamePassVerification(
  interaction: ModalSubmitInteraction,
) {
  const username = interaction.fields
    .getTextInputValue("robloxUsername")
    .trim();

  await interaction.deferReply({ ephemeral: true });

  if (!username) {
    await interaction.editReply("Please enter your Roblox username.");
    return;
  }

  try {
    const robloxUserId = await resolveRobloxUserId(username);

    if (!robloxUserId) {
      await interaction.editReply(
        `I could not find the Roblox username **${username}**. Check the spelling and try again.`,
      );
      return;
    }

    const ownsPass = await ownsCocoXGamePass(robloxUserId);

    if (ownsPass) {
      await interaction.editReply(
        `✅ Purchase detected! **${username}** already owns the **CocoX** Roblox gamepass. Check your DMs for your ticket code.`,
      );

      await sendVerifiedTicket(username, interaction.user);
      return;
    }

    try {
      await interaction.user.send({
        embeds: [cocoXPurchaseDmEmbed(username)],
        components: cocoXPurchaseDmComponents(),
      });
    } catch {
      await interaction.editReply(
        "I found your Roblox account, but I could not DM you. Enable DMs from server members, then press Start Purchase again.",
      );
      return;
    }

    await interaction.editReply(
      `✅ Purchase instructions sent to your DMs.\n\n` +
        `I will check **${username}** every **10 seconds** for the CocoX gamepass.`,
    );

    await monitorCocoXGamePass(
      interaction.user.id,
      robloxUserId,
      username,
      interaction.user,
    );
  } catch (error) {
    logger.warn(
      {
        err: error,
        username,
        gamePassId: COCOX_GAMEPASS_ID,
      },
      "Unable to verify CocoX gamepass",
    );

    await interaction.editReply(
      "Roblox gamepass verification is temporarily unavailable. Please try again.",
    );
  }
}

async function ownsMozaGamePass(userId: number): Promise<boolean> {
  const response = await fetch(
    `https://inventory.roblox.com/v1/users/${userId}/items/gamepass/${MOZA_GAMEPASS_ID}/is-owned`,
  );
  if (!response.ok) {
    throw new Error(
      `Roblox Moza gamepass ownership check failed with ${response.status}`,
    );
  }
  const body = (await response.json()) as boolean | { isOwned?: boolean };
  return typeof body === "boolean" ? body : body.isOwned === true;
}

function generateMozaTicketCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let random = "";
  for (let i = 0; i < 10; i++)
    random += chars[Math.floor(Math.random() * chars.length)];
  return `Moza-${random}`;
}

async function sendMozaVerifiedTicket(username: string, user: any) {
  const ticketCode = generateMozaTicketCode();
  await user.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0x22c55e)
        .setTitle("✅ Moza Purchase Detected!")
        .setDescription(
          `Your purchase of **Moza** has been detected successfully!\n\n` +
            `Roblox Username: **${username}**\n\nTicket Code:\n**${ticketCode}**\n\n` +
            `📸 **Take a screenshot of this message and open a ticket.**\n\n` +
            `Send the screenshot in your ticket so your purchase can be verified.`,
        )
        .addFields({ name: "🎫 Ticket", value: ticketCode, inline: false })
        .setFooter({ text: "Moza Purchase Verification" })
        .setTimestamp(),
    ],
  });
}

async function monitorMozaGamePass(
  discordUserId: string,
  robloxUserId: number,
  username: string,
  user: any,
) {
  const checkKey = `${discordUserId}:moza-gamepass`;
  const current = activeChecks.get(checkKey);
  if (current) clearInterval(current);

  let checks = 0;
  const timer = setInterval(async () => {
    checks += 1;
    try {
      if (await ownsMozaGamePass(robloxUserId)) {
        clearInterval(timer);
        activeChecks.delete(checkKey);
        await sendMozaVerifiedTicket(username, user);
        return;
      }
    } catch (error) {
      logger.warn(
        { err: error, robloxUserId, gamePassId: MOZA_GAMEPASS_ID },
        "Roblox Moza gamepass check failed",
      );
    }

    if (checks >= MAX_CHECKS) {
      clearInterval(timer);
      activeChecks.delete(checkKey);
      await user.send(
        `I could not detect the Moza gamepass within 10 minutes.\n\n` +
          `Press **Start Purchase** again to retry.\n\n${MOZA_GAMEPASS_URL}`,
      );
    }
  }, CHECK_INTERVAL_MS);

  activeChecks.set(checkKey, timer);
}

async function handleMozaGamePassVerification(
  interaction: ModalSubmitInteraction,
) {
  const username = interaction.fields
    .getTextInputValue("robloxUsername")
    .trim();
  await interaction.deferReply({ ephemeral: true });

  if (!username) {
    await interaction.editReply("Please enter your Roblox username.");
    return;
  }

  try {
    const robloxUserId = await resolveRobloxUserId(username);
    if (!robloxUserId) {
      await interaction.editReply(
        `I could not find the Roblox username **${username}**.`,
      );
      return;
    }

    if (await ownsMozaGamePass(robloxUserId)) {
      await interaction.editReply(
        `✅ Purchase detected! **${username}** already owns **Moza**. Check your DMs for your ticket code.`,
      );
      await sendMozaVerifiedTicket(username, interaction.user);
      return;
    }

    await interaction.user.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x00e5ff)
          .setTitle("🛒 Complete Your Moza Purchase")
          .setDescription(
            `Please purchase the **Moza Roblox Gamepass** below.\n\n` +
              `I will automatically check **${username}** every **10 seconds**.`,
          )
          .addFields(
            { name: "🛒 Product", value: "Moza", inline: true },
            { name: "💰 Payment", value: "Roblox Gamepass", inline: true },
            { name: "🔄 Checking", value: "Every 10 seconds", inline: true },
          )
          .setTimestamp(),
      ],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel("Purchase Moza")
            .setStyle(ButtonStyle.Link)
            .setURL(MOZA_GAMEPASS_URL),
        ),
      ],
    });

    await interaction.editReply(
      `✅ Moza purchase instructions sent to your DMs. I will check **${username}** every **10 seconds**.`,
    );
    await monitorMozaGamePass(
      interaction.user.id,
      robloxUserId,
      username,
      interaction.user,
    );
  } catch (error) {
    logger.warn(
      { err: error, username, gamePassId: MOZA_GAMEPASS_ID },
      "Unable to verify Moza gamepass",
    );
    await interaction.editReply(
      "Roblox gamepass verification is temporarily unavailable. Please try again.",
    );
  }
}

async function hasPurchased(userId: number, assetId: number): Promise<boolean> {
  const response = await fetch(
    `https://inventory.roblox.com/v1/users/${userId}/items/Asset/${assetId}/is-owned`,
  );

  if (!response.ok) {
    throw new Error(`Roblox ownership check failed with ${response.status}`);
  }

  const body = (await response.json()) as boolean | { isOwned?: boolean };
  return typeof body === "boolean" ? body : body.isOwned === true;
}

async function monitorPurchase(
  discordUserId: string,
  robloxUserId: number,
  item: StoreItem,
  user: {
    send: (payload: string | { embeds: EmbedBuilder[] }) => Promise<unknown>;
  },
) {
  if (!item.assetId) return;

  const checkKey = `${discordUserId}:${item.id}`;
  const current = activeChecks.get(checkKey);
  if (current) clearInterval(current);

  let checks = 0;
  const timer = setInterval(async () => {
    checks += 1;

    try {
      const purchased = await hasPurchased(robloxUserId, item.assetId!);
      if (purchased) {
        clearInterval(timer);
        activeChecks.delete(checkKey);
        await user.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x22c55e)
              .setTitle("✅ Purchase Detected")
              .setDescription(
                `Your purchase for **${item.name}** was detected successfully. Your order is ready for the delivery step.`,
              )
              .setTimestamp(),
          ],
        });
        return;
      }
    } catch (error) {
      logger.warn(
        { err: error, itemId: item.id },
        "Roblox purchase check failed",
      );
    }

    if (checks >= MAX_CHECKS) {
      clearInterval(timer);
      activeChecks.delete(checkKey);
      await user.send(
        "I could not detect the purchase within the checking window. If you already paid, press Check Purchase again or contact support.",
      );
    }
  }, CHECK_INTERVAL_MS);

  activeChecks.set(checkKey, timer);
}

async function handleVerification(
  interaction: ModalSubmitInteraction,
  item: StoreItem,
) {
  const username = interaction.fields
    .getTextInputValue("robloxUsername")
    .trim();
  await interaction.deferReply();

  if (!username) {
    await interaction.editReply("Please enter your Roblox username.");
    return;
  }

  try {
    const robloxUserId = await resolveRobloxUserId(username);
    if (!robloxUserId || !item.assetId) {
      await interaction.editReply(
        "I could not verify that Roblox username or item.",
      );
      return;
    }

    const purchased = await hasPurchased(robloxUserId, item.assetId);
    if (purchased) {
      await interaction.editReply(
        `✅ Purchase detected for **${item.name}**. Your order is ready for the delivery step.`,
      );
      return;
    }

    await interaction.editReply(
      "Purchase not detected yet. I will keep checking every 20 seconds for up to 10 minutes.",
    );

    await monitorPurchase(
      interaction.user.id,
      robloxUserId,
      item,
      interaction.user,
    );
  } catch (error) {
    logger.warn({ err: error, username }, "Unable to verify Roblox purchase");
    await interaction.editReply(
      "Roblox verification is temporarily unavailable. Please try again in a moment.",
    );
  }
}

async function handleInteraction(interaction: Interaction) {
  if (isScriptInteraction(interaction)) {
    // Public loaders always use the production database. Never let the development
    // bot race the published bot and issue unusable development-only keys.
    if (process.env.REPLIT_DEPLOYMENT === "1") {
      await handleScriptInteraction(interaction, { claim: true });
    }
    return;
  }
  if (
    interaction.isButton() &&
    (interaction.customId === "purchase:start" ||
      interaction.customId === "purchase:start:v2")
  ) {
    await interaction.reply({
      content: "Which product would you like to purchase?",
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("purchase:choose:cocox")
            .setLabel("CocoX")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("purchase:choose:moza")
            .setLabel("Moza")
            .setStyle(ButtonStyle.Success),
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  if (
    interaction.isButton() &&
    (interaction.customId === "purchase:choose:cocox" ||
      interaction.customId === "purchase:choose:moza")
  ) {
    const isMoza = interaction.customId === "purchase:choose:moza";
    const modal = new ModalBuilder()
      .setCustomId(
        isMoza ? "purchase:moza-gamepass-form" : "purchase:cocox-gamepass-form",
      )
      .setTitle(isMoza ? "Moza Purchase" : "CocoX Purchase");

    const usernameInput = new TextInputBuilder()
      .setCustomId("robloxUsername")
      .setLabel("Enter your Roblox username")
      .setPlaceholder("Example: RobloxUsername")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(usernameInput),
    );
    await interaction.showModal(modal);
    return;
  }

  if (
    interaction.isModalSubmit() &&
    interaction.customId === "purchase:moza-gamepass-form"
  ) {
    await handleMozaGamePassVerification(interaction);
    return;
  }

  if (
    interaction.isModalSubmit() &&
    interaction.customId === "purchase:cocox-gamepass-form"
  ) {
    await handleCocoXGamePassVerification(interaction);
    return;
  }

  if (
    interaction.isStringSelectMenu() &&
    (interaction.customId === "purchase:item" ||
      interaction.customId === "purchase:item:v2")
  ) {
    const item = findItem(interaction.values[0]);
    if (!item) {
      await interaction.reply({
        content: "That item is no longer available.",
        ephemeral: true,
      });
      return;
    }

    await interaction.update({
      content: item.assetId
        ? "Review the item below, then choose Purchase to continue in your DMs."
        : "This item is listed on the website but is not available for Roblox purchase yet.",
      embeds: [itemDetailsEmbed(item)],
      components: itemPurchaseComponents(item),
    });
    return;
  }

  if (
    interaction.isButton() &&
    interaction.customId.startsWith("purchase:verify:")
  ) {
    const item = findItem(interaction.customId.replace("purchase:verify:", ""));
    if (!item) {
      await interaction.reply({ content: "That item is no longer available." });
      return;
    }
    if (!item.assetId) {
      await interaction.reply({
        content:
          "Roblox purchase verification is not configured for this item yet.",
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`purchase:verify-form:${item.id}`)
      .setTitle("Verify Roblox Purchase");
    const usernameInput = new TextInputBuilder()
      .setCustomId("robloxUsername")
      .setLabel("Roblox username")
      .setPlaceholder("Enter your Roblox username")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(usernameInput),
    );
    await interaction.showModal(modal);
    return;
  }

  if (
    interaction.isButton() &&
    interaction.customId.startsWith("purchase:buy:")
  ) {
    const item = findItem(interaction.customId.replace("purchase:buy:", ""));
    if (!item) {
      await interaction.reply({
        content: "That item is no longer available.",
        ephemeral: true,
      });
      return;
    }
    if (!item.available) {
      await interaction.reply({
        content: "That item is currently out of stock on the website.",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    try {
      await interaction.user.send({
        embeds: [itemDmEmbed(item)],
        components: itemPurchaseComponents(item),
      });
      await interaction.editReply(
        "✅ Purchase instructions sent to your DMs. Open the DM from MeowCheatz to continue.",
      );
    } catch {
      await interaction.editReply(
        "I could not DM you. Enable DMs from server members, then press Purchase again.",
      );
    }
    return;
  }

  if (
    interaction.isModalSubmit() &&
    interaction.customId.startsWith("purchase:verify-form:")
  ) {
    const item = findItem(
      interaction.customId.replace("purchase:verify-form:", ""),
    );
    if (!item) {
      await interaction.reply({ content: "That item is no longer available." });
      return;
    }
    await handleVerification(interaction, item);
  }
}

async function ensurePurchasePanel(client: Client<true>) {
  const channel = await client.channels.fetch(PURCHASE_CHANNEL_ID);
  if (!channel?.isTextBased() || channel.isDMBased()) {
    throw new Error(
      `Purchase channel ${PURCHASE_CHANNEL_ID} is not a server text channel`,
    );
  }

  const textChannel = channel as TextChannel;
  const messages = await textChannel.messages.fetch({ limit: 50 });
  const currentPanel = messages.find(
    (message) =>
      message.author.id === client.user.id &&
      message.embeds.some(
        (embed) =>
          embed.title === "🛒 CocoX / Moza Scripts Store" &&
          embed.footer?.text === CURRENT_PANEL_FOOTER,
      ),
  );

  const outdatedPanels = messages.filter(
    (message) =>
      message.author.id === client.user.id &&
      message.embeds.some(
        (embed) =>
          embed.title === "🛒 Welcome to the Store" ||
          embed.title === "🛒 CocoX / Moza Scripts Store",
      ) &&
      message !== currentPanel,
  );

  for (const outdatedPanel of outdatedPanels.values()) {
    await outdatedPanel.edit({
      embeds: [outdatedPurchasePanelEmbed()],
      components: [],
    });
  }

  if (currentPanel) {
    await currentPanel.edit({
      embeds: [purchasePanelEmbed()],
      components: purchasePanelComponents(),
    });
  } else {
    await textChannel.send({
      embeds: [purchasePanelEmbed()],
      components: purchasePanelComponents(),
    });
  }
}

export async function startDiscordBot() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    logger.info("DISCORD_BOT_TOKEN is not set; Discord bot is disabled");
    return;
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
    partials: [Partials.Channel],
  });
  bindIpReportBot(client);

  client.once(Events.ClientReady, async (readyClient) => {
    logger.info(
      { username: readyClient.user.tag, channelId: PURCHASE_CHANNEL_ID },
      "Discord purchase bot connected",
    );
    if (process.env.REPLIT_DEPLOYMENT === "1") {
      try {
        await registerScriptCommands(readyClient);
        logger.info("Code Redeemer commands are ready");
      } catch {
        logger.warn("Code Redeemer commands could not be registered; check application command permissions");
      }
    } else {
      logger.info("Code Redeemer Discord commands activate in the published deployment only");
    }
    try {
      await ensurePurchasePanel(readyClient);
      logger.info(
        { channelId: PURCHASE_CHANNEL_ID },
        "Purchase panel is ready",
      );
    } catch (error) {
      logger.error(
        { err: error, channelId: PURCHASE_CHANNEL_ID },
        "Could not publish purchase panel",
      );
    }
  });

  client.on(Events.InteractionCreate, (interaction) => {
    void handleInteraction(interaction).catch((error) => {
      logger.error({ err: error }, "Discord interaction failed");
    });
  });

  await client.login(token);
}
