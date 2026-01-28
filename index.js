import { Client, GatewayIntentBits, Partials, ChannelType, PermissionsBitField } from "discord.js";
import dotenv from "dotenv";
dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith("!ticket")) return;

  // Delete command message
  await message.delete().catch(() => {});

  // DM user
  await message.author.send(
    "🎫 **Ticket Options**\n\n" +
    "A️⃣ Payment (IRL money)\n" +
    "B️⃣ In-game items\n" +
    "C️⃣ Refund\n\n" +
    "Reply with **A**, **B**, or **C**"
  );

  const filter = m => m.author.id === message.author.id;
  const collected = await message.author.dmChannel.awaitMessages({
    filter,
    max: 1,
    time: 60000
  }).catch(() => null);

  if (!collected) return;

  const choice = collected.first().content.toUpperCase();

  const guild = message.guild;
  const category = guild.channels.cache.find(
    c => c.name === "tickets" && c.type === ChannelType.GuildCategory
  );

  const channel = await guild.channels.create({
    name: `ticket-${message.author.username}`,
    type: ChannelType.GuildText,
    parent: category?.id,
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: message.author.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
      }
    ]
  });

  channel.send(
    `🎟️ **New Ticket**\n` +
    `User: ${message.author}\n` +
    `Type: **${choice}**`
  );
});

client.login(process.env.TOKEN);
