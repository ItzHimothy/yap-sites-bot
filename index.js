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
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

/* ================= READY ================= */

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

/* ================= TICKET PANEL COMMAND ================= */

client.on("messageCreate", async (message) => {
  if (!message.guild) return;
  if (message.guild.id !== ALLOWED_GUILD_ID) return;
  if (message.author.bot) return;

  if (message.content === "!ticketpanel") {
    const embed = new EmbedBuilder()
      .setTitle("🎟️ Open a Ticket")
      .setDescription("Choose a reason below")
      .setColor(0x5865f2);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_payment")
        .setLabel("Payment (IRL)")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("ticket_ingame")
        .setLabel("In-game")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("ticket_refund")
        .setLabel("Refund")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("ticket_support")
        .setLabel("Support")
        .setStyle(ButtonStyle.Secondary)
    );

    return message.channel.send({ embeds: [embed], components: [row] });
  }
});

/* ================= BUTTON HANDLER ================= */

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.guild.id !== ALLOWED_GUILD_ID) return;

  const typeMap = {
    ticket_payment: "payment",
    ticket_ingame: "ingame",
    ticket_refund: "refund",
    ticket_support: "support"
  };

  const type = typeMap[interaction.customId];
  if (!type) return;

  const channel = await interaction.guild.channels.create({
    name: `ticket-${type}-${interaction.user.username}`,
    parent: TICKET_CATEGORY_ID,
    permissionOverwrites: [
      {
        id: interaction.guild.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: interaction.user.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
      },
      {
        id: STAFF_ROLE_ID,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
      }
    ]
  });

  await channel.send(
    `👋 Hello ${interaction.user}\nPlease explain your **${type}** issue.`
  );

  const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
  if (logChannel) {
    logChannel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("🎟️ Ticket Created")
          .setColor(0x00ff00)
          .addFields(
            { name: "User", value: `${interaction.user}`, inline: true },
            { name: "Type", value: type, inline: true },
            { name: "Channel", value: `${channel}` }
          )
          .setTimestamp()
      ]
    });
  }

  await interaction.reply({
    content: `✅ Ticket created: ${channel}`,
    ephemeral: true
  });
});

/* ================= MESSAGE DELETE LOG ================= */

client.on("messageDelete", async (message) => {
  if (!message.guild) return;
  if (message.guild.id !== ALLOWED_GUILD_ID) return;
  if (!message.content) return;

  const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!logChannel) return;

  logChannel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("🗑️ Message Deleted")
        .setColor(0xff0000)
        .addFields(
          { name: "User", value: `${message.author}` },
          { name: "Channel", value: `${message.channel}` },
          { name: "Content", value: message.content.slice(0, 1000) }
        )
        .setTimestamp()
    ]
  });
});

/* ================= MESSAGE EDIT LOG ================= */

client.on("messageUpdate", async (oldMsg, newMsg) => {
  if (!oldMsg.guild) return;
  if (oldMsg.guild.id !== ALLOWED_GUILD_ID) return;
  if (oldMsg.content === newMsg.content) return;

  const logChannel = oldMsg.guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!logChannel) return;

  logChannel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("✏️ Message Edited")
        .setColor(0xffc107)
        .addFields(
          { name: "User", value: `${oldMsg.author}` },
          { name: "Before", value: oldMsg.content || "None" },
          { name: "After", value: newMsg.content || "None" }
        )
        .setTimestamp()
    ]
  });
});

/* ================= LOGIN ================= */

client.login(process.env.TOKEN);
