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
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User]
});

/* ================= CONFIG ================= */
const ALLOWED_GUILD_ID = "1465718425765679135";
const SUPPORT_ROLE_ID = "1465948974111396014";
const TICKET_CATEGORY_ID = "1465723833729286144";
const LOG_CHANNEL_ID = "1465725426704977981";
const WELCOME_CHANNEL_ID = "1465721058991538197";

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const SEVERE_TRIGGERS = [
  "kys",
  "kill yourself",
  "rape",
  "rapist",
  "pedo",
  "pedophile",
  "child porn",
  "cp"
];

const DISCORD_INVITE_REGEX = /(discord\.gg\/|discord\.com\/invite\/)\S+/i;
const YOUTUBE_REGEX = /(youtube\.com\/|youtu\.be\/)\S+/i;
/* ========================================== */

const botDeletedReason = new Map();

function isTicketChannel(channel) {
  return channel?.parentId === TICKET_CATEGORY_ID || channel?.name?.startsWith("ticket-");
}

function log(guild, embed) {
  const ch = guild.channels.cache.get(LOG_CHANNEL_ID);
  if (ch) ch.send({ embeds: [embed] }).catch(() => {});
}

/* ================= READY ================= */
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // Lock bot to only your server
  client.guilds.cache.forEach(guild => {
    if (guild.id !== ALLOWED_GUILD_ID) {
      guild.leave().catch(() => {});
    }
  });
});

/* ================= WELCOME ================= */
client.on("guildMemberAdd", member => {
  const ch = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setTitle("👋 Welcome!")
    .setDescription(
      `Welcome ${member}!\n` +
      `You are member **#${member.guild.memberCount}** 🎉`
    )
    .setColor(0x57F287)
    .setTimestamp();

  ch.send({ embeds: [embed] }).catch(() => {});
});

/* ================= MESSAGE HANDLER ================= */
client.on("messageCreate", async (message) => {
  if (!message.guild) return;
  if (message.author.bot) return;

  const member = message.member;
  const isStaff =
    member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.roles.cache.has(SUPPORT_ROLE_ID);

  const content = message.content.toLowerCase();

  /* ===== PURGE COMMAND ===== */
  if (content.startsWith("!purge")) {
    if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

    await message.delete().catch(() => {});
    const args = content.split(" ").slice(1);
    const amount = args[0];

    if (!amount) return;

    if (amount === "all") {
      let fetched;
      do {
        fetched = await message.channel.messages.fetch({ limit: 100 });
        await message.channel.bulkDelete(fetched, true);
      } while (fetched.size >= 2);
      return;
    }

    const num = parseInt(amount);
    if (isNaN(num) || num < 1 || num > 100) return;

    const msgs = await message.channel.messages.fetch({ limit: num + 1 });
    await message.channel.bulkDelete(msgs, true);
    return;
  }

  /* ===== TICKET COMMAND ===== */
  if (content === "!ticket") {
    await message.delete().catch(() => {});

    const embed = new EmbedBuilder()
      .setTitle("🎫 Open a Ticket")
      .setDescription("Choose a reason below:")
      .setColor(0x5865F2);

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

    message.channel.send({ embeds: [embed], components: [row] });
    return;
  }

  if (isTicketChannel(message.channel)) return;

  /* ===== ANTI-ADVERTISING ===== */
  if (!isStaff && (DISCORD_INVITE_REGEX.test(content) || YOUTUBE_REGEX.test(content))) {
    botDeletedReason.set(message.id, "Advertising");
    await message.delete().catch(() => {});

    log(message.guild, new EmbedBuilder()
      .setTitle("🚫 Advertising Blocked")
      .setDescription(`User: ${message.author.tag}`)
      .setColor(0xED4245)
      .setTimestamp()
    );
    return;
  }

  /* ===== ANTI-ABUSE (SEVERE) ===== */
  if (!isStaff) {
    const hit = SEVERE_TRIGGERS.find(w => content.includes(w));
    if (hit) {
      botDeletedReason.set(message.id, `Severe: ${hit}`);
      await message.delete().catch(() => {});
      await member.timeout(TIMEOUT_MS, "Severe language").catch(() => {});
      log(message.guild, new EmbedBuilder()
        .setTitle("🚨 Auto-Moderation")
        .setDescription(`${message.author.tag} timed out (5 min)`)
        .addFields({ name: "Trigger", value: hit })
        .setColor(0xED4245)
        .setTimestamp()
      );
    }
  }
});

/* ================= BUTTON HANDLER ================= */
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const [_, type, ownerId] = interaction.customId.split("_");
  if (interaction.user.id !== ownerId) {
    return interaction.reply({ content: "❌ Not your ticket.", ephemeral: true });
  }

  const channel = await interaction.guild.channels.create({
    name: `ticket-${type}-${interaction.user.username}`.toLowerCase(),
    parent: TICKET_CATEGORY_ID,
    permissionOverwrites: [
      { id: interaction.guild.id, deny: ["ViewChannel"] },
      { id: interaction.user.id, allow: ["ViewChannel", "SendMessages"] },
      { id: SUPPORT_ROLE_ID, allow: ["ViewChannel", "SendMessages"] }
    ]
  });

  const embed = new EmbedBuilder()
    .setTitle("👋 Hello!")
    .setDescription(
      `Thanks for opening a **${type.toUpperCase()}** ticket.\n` +
      `Please explain your issue clearly.\n\nType **!close** to close.`
    )
    .setColor(0x57F287);

  channel.send({ content: `<@${interaction.user.id}> <@&${SUPPORT_ROLE_ID}>`, embeds: [embed] });

  interaction.message.delete().catch(() => {});
  interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });

  log(interaction.guild, new EmbedBuilder()
    .setTitle("🎟 Ticket Created")
    .setDescription(`${channel}`)
    .setColor(0x5865F2)
    .setTimestamp()
  );
});

/* ================= MESSAGE DELETE LOG ================= */
client.on("messageDelete", message => {
  if (!message.guild || !message.author) return;

  const embed = new EmbedBuilder()
    .setTitle("🗑 Message Deleted")
    .addFields(
      { name: "User", value: message.author.tag },
      { name: "Channel", value: message.channel.toString() },
      { name: "Reason", value: botDeletedReason.get(message.id) || "Manual / Unknown" }
    )
    .setColor(0xFAA61A)
    .setTimestamp();

  botDeletedReason.delete(message.id);
  log(message.guild, embed);
});

/* ================= REACTION LOGS ================= */
client.on("messageReactionAdd", (reaction, user) => {
  if (user.bot) return;
  log(reaction.message.guild, new EmbedBuilder()
    .setTitle("➕ Reaction Added")
    .setDescription(`${user.tag} → ${reaction.emoji}`)
    .setColor(0x57F287)
    .setTimestamp()
  );
});

client.on("messageReactionRemove", (reaction, user) => {
  if (user.bot) return;
  log(reaction.message.guild, new EmbedBuilder()
    .setTitle("➖ Reaction Removed")
    .setDescription(`${user.tag} → ${reaction.emoji}`)
    .setColor(0xED4245)
    .setTimestamp()
  );
});

client.login(process.env.TOKEN);
