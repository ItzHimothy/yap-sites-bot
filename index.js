require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  ChannelType
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// ===== CONFIG (FILLED) =====
const GUILD_ID = "1465718425765679135";
const TICKET_CATEGORY_ID = "1465723833729286144";
const STAFF_ROLE_ID = "1465948974111396014";
// ===========================

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// DM ticket flow
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // ===== DMs ONLY =====
  if (message.channel.type === ChannelType.DM) {
    const content = message.content.trim().toUpperCase();

    // Step 1: Send ticket options
    if (content === "!TICKET") {
      return message.author.send(
        `🎟 **Ticket Options**\n\n` +
        `A️⃣ Payment (IRL money)\n` +
        `B️⃣ In-game items\n` +
        `C️⃣ Refund\n\n` +
        `Reply with **A**, **B**, or **C**`
      );
    }

    // Step 2: Handle selection
    if (!["A", "B", "C"].includes(content)) return;

    const selectionMap = {
      A: "payment",
      B: "ingame",
      C: "refund"
    };

    const guild = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(message.author.id);

    const ticketChannel = await guild.channels.create({
      name: `ticket-${selectionMap[content]}-${member.user.username}`,
      type: ChannelType.GuildText,
      parent: TICKET_CATEGORY_ID,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: STAFF_ROLE_ID,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory
          ]
        },
        {
          id: member.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory
          ]
        }
      ]
    });

    await ticketChannel.send(
      `🎫 **New Ticket Created**\n\n` +
      `👤 User: ${member}\n` +
      `📌 Type: **${selectionMap[content].toUpperCase()}**\n\n` +
      `A staff member will assist you shortly.\n\n` +
      `🔒 Staff can use \`!close\` to close this ticket.`
    );

    return message.author.send(
      `✅ Your ticket has been created:\n${ticketChannel}`
    );
  }

  // ===== CLOSE COMMAND (STAFF ONLY) =====
  if (message.content === "!close") {
    if (
      !message.member.roles.cache.has(STAFF_ROLE_ID) &&
      !message.member.permissions.has(PermissionsBitField.Flags.Administrator)
    ) return;

    await message.channel.send("🔒 Closing ticket in 3 seconds...");
    setTimeout(() => message.channel.delete(), 3000);
  }
});

client.login(process.env.TOKEN);
