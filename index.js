require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  ChannelType
} = require("discord.js");

/* ================= CONFIG ================= */

const PREFIX = "!";
const ALLOWED_GUILD_ID = "1465718425765679135";
const TICKET_CATEGORY_ID = "1465723833729286144";
const STAFF_ROLE_ID = "1465948974111396014";

/* ========================================== */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

/* ================= FILTERS ================= */

const badWords = [
  "fuck",
  "shit",
  "nigger",
  "nigga",
  "faggot",
  "retard",
  "cunt"
];

const inviteRegex = /(discord\.gg|discord\.com\/invite)/i;
const youtubeRegex = /(youtube\.com|youtu\.be)/i;

/* ================= READY ================= */

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // Lock bot to your server only
  client.guilds.cache.forEach(guild => {
    if (guild.id !== ALLOWED_GUILD_ID) guild.leave().catch(() => {});
  });
});

/* ================= MESSAGE HANDLER ================= */

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;
  if (message.guild.id !== ALLOWED_GUILD_ID) return;

  const content = message.content.toLowerCase();

  /* ---- Anti Advertising ---- */
  if (inviteRegex.test(content) || youtubeRegex.test(content)) {
    await message.delete().catch(() => {});
    return message.channel.send(
      `🚫 ${message.author}, advertising is not allowed.`
    );
  }

  /* ---- Anti Swear (Hard words only) ---- */
  if (badWords.some(word => content.includes(word))) {
    await message.delete().catch(() => {});
    await message.member.timeout(5 * 60 * 1000, "Swearing");
    return message.channel.send(
      `🤬 ${message.author} has been muted for swearing.`
    );
  }

  /* ---- Commands ---- */
  if (!content.startsWith(PREFIX)) return;

  const args = content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift();

  /* ===== Tickets ===== */

  if (cmd === "ticket" || cmd === "apply") {
    const type = cmd === "apply" ? "apply" : "support";

    const existing = message.guild.channels.cache.find(
      c => c.name === `${type}-${message.author.id}`
    );
    if (existing) return message.reply("❌ You already have an open ticket.");

    const channel = await message.guild.channels.create({
      name: `${type}-${message.author.id}`,
      type: ChannelType.GuildText,
      parent: TICKET_CATEGORY_ID,
      permissionOverwrites: [
        {
          id: message.guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: message.author.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages
          ]
        },
        {
          id: STAFF_ROLE_ID,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages
          ]
        }
      ]
    });

    channel.send(
      `👋 Hello ${message.author}\n\n` +
      `Please explain your **${type === "apply" ? "staff application" : "issue"}**.\n` +
      `<@&${STAFF_ROLE_ID}> will assist you shortly.`
    );

    return message.reply(`✅ Ticket created: ${channel}`);
  }

  /* ===== Moderation ===== */

  if (cmd === "mute") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return;
    const user = message.mentions.members.first();
    const minutes = parseInt(args[1]) || 5;
    if (!user) return;
    await user.timeout(minutes * 60000, "Muted by staff");
    return message.reply(`🔇 ${user.user.tag} muted for ${minutes} minutes.`);
  }

  if (cmd === "unmute") {
    const user = message.mentions.members.first();
    if (!user) return;
    await user.timeout(null);
    return message.reply(`🔊 ${user.user.tag} unmuted.`);
  }

  if (cmd === "kick") {
    const user = message.mentions.members.first();
    if (!user) return;
    await user.kick("Kicked by staff");
    return message.reply(`👢 ${user.user.tag} kicked.`);
  }

  if (cmd === "ban") {
    const user = message.mentions.members.first();
    if (!user) return;
    await user.ban({ reason: "Banned by staff" });
    return message.reply(`⛔ ${user.user.tag} banned.`);
  }
});

/* ================= SAFETY ================= */

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

/* ================= LOGIN ================= */

client.login(process.env.TOKEN);
