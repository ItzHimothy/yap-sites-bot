const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// CONFIG
const STAFF_ROLE_ID = "1465948974111396014";
const CATEGORY_ID = "1465723833729286144";

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.content !== "!ticket") return;

  // delete user's message
  await message.delete().catch(() => {});

  // buttons
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_payment")
      .setLabel("💰 Payment (IRL)")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("ticket_items")
      .setLabel("🎮 In-game items")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("ticket_refund")
      .setLabel("🔄 Refund")
      .setStyle(ButtonStyle.Danger)
  );

  await message.channel.send({
    content: "🎫 **Open a ticket**\nChoose a reason:",
    components: [row]
  });
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const typeMap = {
    ticket_payment: "payment",
    ticket_items: "items",
    ticket_refund: "refund"
  };

  const type = typeMap[interaction.customId];
  if (!type) return;

  const guild = interaction.guild;
  const user = interaction.user;

  // create channel
  const channel = await guild.channels.create({
    name: `ticket-${type}-${user.username}`.toLowerCase(),
    parent: CATEGORY_ID,
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      },
      {
        id: STAFF_ROLE_ID,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      }
    ]
  });

  await channel.send(
    `<@${user.id}> <@&${STAFF_ROLE_ID}>\n` +
    `**Ticket Type:** ${type.toUpperCase()}\n` +
    `Please describe your issue.`
  );

  await interaction.reply({
    content: `✅ Ticket created: ${channel}`,
    ephemeral: true
  });
});

client.login(process.env.TOKEN);
