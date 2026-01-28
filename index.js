require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionsBitField
} = require("discord.js");

/* ================= CONFIG ================= */

const ALLOWED_GUILD_ID = "1465718425765679135";
const TICKET_CATEGORY_ID = "1465723833729286144";
const STAFF_ROLE_ID = "1465948974111396014";
const LOG_CHANNEL_ID = "1465725426704977981";

/* ================= CLIENT ================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel]
});

/* ================= READY ================= */

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

/* ================= TICKET PANEL ================= */

client.on("messageCreate", async (message) => {
  if (!message.guild) return;
  if (message.guild.id !== ALLOWED_GUILD_ID) return;
  if (message.author.bot) return;

  // Ticket panel
  if (message.content === "!ticketpanel") {
    await message.delete().catch(() => {});

    const embed = new EmbedBuilder()
      .setTitle("🎟️ Open a Ticket")
      .setDescription("Choose an option below")
      .setColor(0x5865f2);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`website_${message.author.id}`)
        .setLabel("🌐 Website Idea")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`features_${message.author.id}`)
        .setLabel("⚙️ Features Request")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`partner_${message.author.id}`)
        .setLabel("🤝 Partnership")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`apply_${message.author.id}`)
        .setLabel("🧑‍💼 Staff Application")
        .setStyle(ButtonStyle.Danger)
    );

    const panel = await message.channel.send({
      embeds: [embed],
      components: [row]
    });

    setTimeout(() => panel.delete().catch(() => {}), 120000);
  }

  // Staff apply command
  if (message.content === "!apply") {
    await message.delete().catch(() => {});
    createTicket(message, "staff-application", 
      "🧑‍💼 **Staff Application**\n\nWhy should we choose you?\nWhat experience do you have?"
    );
  }
});

/* ================= BUTTON HANDLER ================= */

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.guild.id !== ALLOWED_GUILD_ID) return;

  const [type, ownerId] = interaction.customId.split("_");
  if (interaction.user.id !== ownerId) {
    return interaction.reply({ content: "❌ This panel isn’t yours.", ephemeral: true });
  }

  await interaction.message.delete().catch(() => {});

  let question = "";
  let name = "";

  if (type === "website") {
    name = "website";
    question = "🌐 **What would you like your website to be about?**";
  } else if (type === "features") {
    name = "features";
    question = "⚙️ **What features do you want on your website?**";
  } else if (type === "partner") {
    name = "partnership";
    question = "🤝 **Tell us about your partnership request.**";
  } else if (type === "apply") {
    name = "staff-application";
    question = "🧑‍💼 **Why should we choose you? What experience do you have?**";
  }

  createTicket(interaction, name, question, true);
});

/* ================= CREATE TICKET FUNCTION ================= */

async function createTicket(source, type, messageText, isInteraction = false) {
  const guild = source.guild;
  const user = isInteraction ? source.user : source.author;

  const channel = await guild.channels.create({
    name: `ticket-${type}-${user.username}`,
    parent: TICKET_CATEGORY_ID,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      { id: STAFF_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
    ]
  });

  const closeBtn = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("close_ticket")
      .setLabel("🔒 Close Ticket")
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({ content: `👋 Hello ${user}\n\n${messageText}`, components: [closeBtn] });

  const log = guild.channels.cache.get(LOG_CHANNEL_ID);
  log?.send(`🎟️ **Ticket Created** | ${user} | ${channel}`);

  if (isInteraction) {
    source.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
  }
}

/* ================= CLOSE TICKET ================= */

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== "close_ticket") return;

  const log = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
  log?.send(`🔒 **Ticket Closed** | ${interaction.channel.name}`);

  await interaction.channel.delete();
});

/* ================= MESSAGE LOGS ================= */

client.on("messageDelete", (msg) => {
  if (!msg.guild || msg.guild.id !== ALLOWED_GUILD_ID || !msg.content) return;
  client.channels.cache.get(LOG_CHANNEL_ID)
    ?.send(`🗑️ **Deleted** | ${msg.author} | ${msg.channel}\n${msg.content}`);
});

client.on("messageUpdate", (o, n) => {
  if (!o.guild || o.guild.id !== ALLOWED_GUILD_ID) return;
  if (o.content === n.content) return;
  client.channels.cache.get(LOG_CHANNEL_ID)
    ?.send(`✏️ **Edited** | ${o.author}\n**Before:** ${o.content}\n**After:** ${n.content}`);
});

/* ================= LOGIN ================= */

client.login(process.env.TOKEN);
