const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");

require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,          // welcome
    GatewayIntentBits.GuildMessages,         // automod + commands
    GatewayIntentBits.MessageContent,        // read message text
    GatewayIntentBits.GuildMessageReactions  // reaction logs
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User
  ]
});

/* =========================
   CONFIG (YOUR IDS)
========================= */
const SUPPORT_ROLE_ID = "1465948974111396014";
const TICKET_CATEGORY_ID = "1465723833729286144";
const LOG_CHANNEL_ID = "1465725426704977981";
const WELCOME_CHANNEL_ID = "1465721058991538197";

const TIMEOUT_MS_SEVERE = 5 * 60 * 1000; // 5 minutes

// Anti-abuse: SEVERE ONLY. Add/remove as you want.
// I’m intentionally NOT adding “small swears” here.
const SEVERE_TRIGGERS = [
  // threats / self-harm encouragement
  "kys",
  "kill yourself",
  // sexual violence / minors (examples)
  "rape",
  "rapist",
  "pedo",
  "pedophile",
  "child porn",
  "cp"
];

// Advertising blocks (public channels only)
const DISCORD_INVITE_REGEX = /(discord\.gg\/|discord\.com\/invite\/|discordapp\.com\/invite\/)\S+/i;
const YOUTUBE_REGEX = /(\byoutube\.com\/\S+|\byoutu\.be\/\S+)/i;

// Optional: don’t run automod in these channels by name
const SAFE_CHANNEL_NAMES = new Set([
  // "rules",
  // "announcements"
]);

/* =========================
   INTERNAL TRACKING
========================= */
// Track bot deletions so messageDelete logs can say WHY it was deleted
const botDeletedReason = new Map(); // messageId -> reason

// Quick helper
function isTicketChannel(channel) {
  if (!channel) return false;
  if (channel.parentId === TICKET_CATEGORY_ID) return true;
  if (channel.name && channel.name.startsWith("ticket-")) return true;
  return false;
}

function getLogChannel(guild) {
  return guild?.channels?.cache?.get(LOG_CHANNEL_ID) || null;
}

async function logEmbed(guild, embed) {
  const ch = getLogChannel(guild);
  if (!ch) return;
  await ch.send({ embeds: [embed] }).catch(() => {});
}

/* =========================
   READY
========================= */
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

/* =========================
   WELCOME MESSAGE
========================= */
client.on("guildMemberAdd", async (member) => {
  const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle("👋 Welcome!")
    .setDescription(
      `Welcome ${member}!\n` +
      `You are member **#${member.guild.memberCount}** 🎉\n\n` +
      `Make yourself at home!`
    )
    .setTimestamp()
    .setColor(0x57F287);

  await channel.send({ embeds: [embed] }).catch(() => {});
});

/* =========================
   ANTI-ABUSE + ANTI-ADS + COMMANDS
========================= */
client.on("messageCreate", async (message) => {
  try {
    if (!message.guild) return;
    if (message.author.bot) return;

    // ignore selected safe channels
    if (SAFE_CHANNEL_NAMES.has(message.channel?.name)) return;

    const member = message.member;

    // ignore admins & support role
    const isStaff =
      member?.permissions?.has(PermissionsBitField.Flags.Administrator) ||
      member?.roles?.cache?.has(SUPPORT_ROLE_ID);

    // Do NOT run automod/ads inside ticket channels
    const inTicket = isTicketChannel(message.channel);

    const contentLower = (message.content || "").toLowerCase();

    /* ========== TICKET COMMAND (!ticket) ==========
       - Deletes user command
       - Sends buttons (locked to that user)
       - Only that user can click
    */
    if (contentLower === "!ticket") {
      await message.delete().catch(() => {});

      const embed = new EmbedBuilder()
        .setTitle("🎫 Open a Ticket")
        .setDescription("Choose a reason below:")
        .setColor(0x5865F2);

      // lock to the user who ran the command
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_payment_${message.author.id}`)
          .setLabel("💰 Payment (IRL)")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`ticket_items_${message.author.id}`)
          .setLabel("🎮 In-game Items")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`ticket_refund_${message.author.id}`)
          .setLabel("🔄 Refund")
          .setStyle(ButtonStyle.Danger)
      );

      await message.channel.send({ embeds: [embed], components: [row] });
      return;
    }

    /* ========== CLOSE COMMAND (!close) ==========
       - Works in ticket channels only
       - Ticket owner OR staff can close
    */
    if (contentLower === "!close") {
      if (!inTicket) return;

      const canClose =
        isStaff ||
        message.channel.permissionOverwrites.cache.has(message.author.id); // user overwrite exists

      if (!canClose) return;

      const closing = new EmbedBuilder()
        .setDescription("🔒 Closing ticket in **3 seconds**...")
        .setColor(0xED4245);

      await message.channel.send({ embeds: [closing] }).catch(() => {});
      setTimeout(() => message.channel.delete().catch(() => {}), 3000);

      const log = new EmbedBuilder()
        .setTitle("🎟 Ticket Closed")
        .setDescription(`Channel: **#${message.channel.name}**`)
        .addFields(
          { name: "Closed by", value: `${message.author.tag}`, inline: true }
        )
        .setTimestamp()
        .setColor(0xED4245);

      await logEmbed(message.guild, log);
      return;
    }

    // If it's a ticket channel, stop here for automod/ads
    if (inTicket) return;

    /* ========== ANTI-ADVERTISING ==========
       - Deletes Discord invites and YouTube links
       - Only for non-staff
    */
    if (!isStaff) {
      const isInvite = DISCORD_INVITE_REGEX.test(contentLower);
      const isYT = YOUTUBE_REGEX.test(contentLower);

      if (isInvite || isYT) {
        botDeletedReason.set(message.id, isInvite ? "Blocked Discord invite" : "Blocked YouTube advertising");

        await message.delete().catch(() => {});

        const embed = new EmbedBuilder()
          .setTitle("🚫 Advertising Blocked")
          .setDescription(
            `Deleted a message from **${message.author.tag}**\n` +
            `Reason: **${isInvite ? "Discord invite link" : "YouTube promotion link"}**`
          )
          .addFields(
            { name: "Channel", value: `${message.channel}`, inline: true }
          )
          .setTimestamp()
          .setColor(0xED4245);

        await logEmbed(message.guild, embed);
        return;
      }
    }

    /* ========== ANTI-ABUSE (SEVERE ONLY) ==========
       - Severe triggers → delete + 5 min timeout
       - Only for non-staff
    */
    if (!isStaff) {
      const matched = SEVERE_TRIGGERS.find((w) => contentLower.includes(w));
      if (matched) {
        botDeletedReason.set(message.id, `Severe language trigger: ${matched}`);

        await message.delete().catch(() => {});

        // timeout
        await member.timeout(TIMEOUT_MS_SEVERE, `Severe language detected: ${matched}`).catch(() => {});

        // DM user (optional — you can remove if you want)
        await message.author
          .send("🚫 You were timed out for **5 minutes** for severe language.")
          .catch(() => {});

        // log
        const embed = new EmbedBuilder()
          .setTitle("🚨 Auto-Moderation: Severe Language")
          .setDescription(`Action: **5-minute timeout**`)
          .addFields(
            { name: "User", value: `${message.author.tag} (${message.author.id})`, inline: false },
            { name: "Channel", value: `${message.channel}`, inline: true },
            { name: "Trigger", value: matched, inline: true }
          )
          .setTimestamp()
          .setColor(0xED4245);

        await logEmbed(message.guild, embed);
        return;
      }
    }
  } catch (e) {
    // avoid crashing on unexpected errors
    console.error("messageCreate error:", e);
  }
});

/* =========================
   BUTTONS: CREATE TICKET (LOCKED TO USER)
========================= */
client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isButton()) return;

    const parts = interaction.customId.split("_");
    if (parts[0] !== "ticket") return;

    const type = parts[1];      // payment/items/refund
    const ownerId = parts[2];   // user id

    // only the user who typed !ticket can click their panel
    if (interaction.user.id !== ownerId) {
      return interaction.reply({
        content: "❌ This ticket panel isn’t for you.",
        ephemeral: true
      });
    }

    const guild = interaction.guild;
    if (!guild) return;

    // create ticket channel
    const ticketName = `ticket-${type}-${interaction.user.username}`.toLowerCase();

    const channel = await guild.channels.create({
      name: ticketName,
      type: ChannelType.GuildText,
      parent: TICKET_CATEGORY_ID,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory
          ]
        },
        {
          id: SUPPORT_ROLE_ID,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory
          ]
        }
      ]
    });

    // hello message in ticket
    const hello = new EmbedBuilder()
      .setTitle("👋 Hello!")
      .setDescription(
        `Hi ${interaction.user}!\n\n` +
        `Thanks for opening a **${type.toUpperCase()}** ticket.\n` +
        `Please explain what you need clearly and a staff member will help you soon.\n\n` +
        `To close this ticket, type **!close**.`
      )
      .setColor(0x57F287)
      .setTimestamp();

    await channel.send({
      content: `<@${interaction.user.id}> <@&${SUPPORT_ROLE_ID}>`,
      embeds: [hello]
    });

    // log ticket creation
    const log = new EmbedBuilder()
      .setTitle("🎟 Ticket Created")
      .setDescription(`Ticket: ${channel}`)
      .addFields(
        { name: "User", value: `${interaction.user.tag} (${interaction.user.id})`, inline: false },
        { name: "Type", value: type.toUpperCase(), inline: true }
      )
      .setTimestamp()
      .setColor(0x5865F2);

    await logEmbed(guild, log);

    // delete the panel message so nobody keeps clicking it
    await interaction.message.delete().catch(() => {});

    // ephemeral confirmation (only user sees it)
    await interaction.reply({
      content: `✅ Ticket created: ${channel}`,
      ephemeral: true
    });
  } catch (e) {
    console.error("interactionCreate error:", e);
    try {
      if (interaction.isRepliable()) {
        await interaction.reply({ content: "❌ Something went wrong creating the ticket.", ephemeral: true });
      }
    } catch {}
  }
});

/* =========================
   LOG: DELETED MESSAGES
========================= */
client.on("messageDelete", async (message) => {
  try {
    if (!message.guild) return;
    if (message.author?.bot) return;

    const reason = botDeletedReason.get(message.id);
    if (reason) botDeletedReason.delete(message.id);

    const content = message.content ? message.content.slice(0, 1800) : "(no text / partial)";

    const embed = new EmbedBuilder()
      .setTitle("🗑 Message Deleted")
      .addFields(
        { name: "User", value: message.author ? `${message.author.tag} (${message.author.id})` : "(unknown)", inline: false },
        { name: "Channel", value: message.channel ? `${message.channel}` : "(unknown)", inline: true },
        { name: "Reason", value: reason || "Unknown (manual delete or missing data)", inline: true },
        { name: "Content", value: content || "(empty)", inline: false }
      )
      .setTimestamp()
      .setColor(0xFAA61A);

    await logEmbed(message.guild, embed);
  } catch (e) {
    console.error("messageDelete error:", e);
  }
});

/* =========================
   LOG: REACTIONS
========================= */
client.on("messageReactionAdd", async (reaction, user) => {
  try {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch().catch(() => {});
    const msg = reaction.message;
    if (!msg.guild) return;

    const embed = new EmbedBuilder()
      .setTitle("➕ Reaction Added")
      .addFields(
        { name: "User", value: `${user.tag} (${user.id})`, inline: false },
        { name: "Channel", value: `${msg.channel}`, inline: true },
        { name: "Emoji", value: `${reaction.emoji}`, inline: true }
      )
      .setTimestamp()
      .setColor(0x57F287);

    await logEmbed(msg.guild, embed);
  } catch (e) {
    console.error("reactionAdd error:", e);
  }
});

client.on("messageReactionRemove", async (reaction, user) => {
  try {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch().catch(() => {});
    const msg = reaction.message;
    if (!msg.guild) return;

    const embed = new EmbedBuilder()
      .setTitle("➖ Reaction Removed")
      .addFields(
        { name: "User", value: `${user.tag} (${user.id})`, inline: false },
        { name: "Channel", value: `${msg.channel}`, inline: true },
        { name: "Emoji", value: `${reaction.emoji}`, inline: true }
      )
      .setTimestamp()
      .setColor(0xED4245);

    await logEmbed(msg.guild, embed);
  } catch (e) {
    console.error("reactionRemove error:", e);
  }
});

client.login(process.env.TOKEN);
const { 
  Client, 
  GatewayIntentBits, 
  PermissionsBitField 
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const PREFIX = "!";

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  if (command === "purge") {
    // Permission check
    if (
      !message.member.permissions.has(PermissionsBitField.Flags.Administrator)
    ) {
      return message.reply("❌ You don’t have permission to use this command.");
    }

    // Delete command message
    await message.delete().catch(() => {});

    const amount = args[0];

    if (!amount) return;

    // PURGE ALL
    if (amount === "all") {
      let fetched;
      do {
        fetched = await message.channel.messages.fetch({ limit: 100 });
        await message.channel.bulkDelete(fetched, true);
      } while (fetched.size >= 2);

      return;
    }

    // PURGE NUMBER
    const deleteCount = parseInt(amount);
    if (isNaN(deleteCount) || deleteCount < 1 || deleteCount > 100) {
      return;
    }

    const messages = await message.channel.messages.fetch({
      limit: deleteCount + 1
    });

    await message.channel.bulkDelete(messages, true);
  }
});

client.login(process.env.TOKEN);
