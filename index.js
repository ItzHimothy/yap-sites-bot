require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
} = require("discord.js");

/* ================================
   CONFIG
================================ */
const ALLOWED_GUILD_ID = "1465718425765679135"; // YOUR SERVER ID
const PREFIX = "!";

/* ================================
   CLIENT SETUP
================================ */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.GuildMember,
    Partials.User,
  ],
});

client.commands = new Collection();
client.prefix = PREFIX;

/* ================================
   READY
================================ */
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // Lock bot to only your server
  for (const guild of client.guilds.cache.values()) {
    if (guild.id !== ALLOWED_GUILD_ID) {
      console.log(`🚫 Leaving unauthorized guild: ${guild.name}`);
      await guild.leave();
    }
  }

  client.user.setPresence({
    activities: [{ name: "Yap Sites", type: 3 }],
    status: "online",
  });
});

/* ================================
   GUILD JOIN LOCK
================================ */
client.on("guildCreate", async (guild) => {
  if (guild.id !== ALLOWED_GUILD_ID) {
    console.log(`🚫 Auto-leaving guild: ${guild.name}`);
    await guild.leave();
  }
});

/* ================================
   BASIC MESSAGE HANDLER (TEMP)
================================ */
client.on("messageCreate", async (message) => {
  // Ignore bots & DMs
  if (message.author.bot) return;
  if (!message.guild) return;

  // Server lock
  if (message.guild.id !== ALLOWED_GUILD_ID) return;

  const content = message.content.toLowerCase();

  /* =====================
     AUTO-MOD
  ===================== */

  // Block Discord invites
  if (/discord\.gg|discord\.com\/invite/.test(content)) {
    await message.delete().catch(() => {});
    return message.channel.send({
      content: `🚫 ${message.author}, Discord invites are not allowed.`,
    });
  }

  // Block YouTube links
  if (/youtube\.com|youtu\.be/.test(content)) {
    await message.delete().catch(() => {});
    return message.channel.send({
      content: `🚫 ${message.author}, YouTube links are not allowed.`,
    });
  }

  // Anti-caps (70%+)
  const letters = message.content.replace(/[^a-zA-Z]/g, "");
  if (letters.length >= 8) {
    const caps = letters.replace(/[^A-Z]/g, "").length;
    if (caps / letters.length > 0.7) {
      await message.delete().catch(() => {});
      return message.channel.send({
        content: `🔠 ${message.author}, please don’t spam caps.`,
      });
    }
  }

  /* =====================
     COMMAND HANDLER
  ===================== */

  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === "ping") {
    return message.reply(`🏓 Pong! ${client.ws.ping}ms`);
  }
});

/* ================================
   ERROR HANDLING
================================ */
process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
});

/* ================================
   LOGIN
================================ */
client.login(process.env.TOKEN);
