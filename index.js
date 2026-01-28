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
  if (message.author.bot) return;
  if (!message.guild) return;
  if (message.guild.id !== ALLOWED_GUILD_ID) return;

  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  if (commandName === "ping") {
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
