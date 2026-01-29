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

const PREFIX = "!";
const ALLOWED_GUILD_ID = "1465718425765679135";

const TICKET_CATEGORY_ID = "1465723833729286144";
const STAFF_ROLE_ID = "1466320528670195895"; // Dev Support Team
const DEV_ROLE_ID = "1466321400553017525";   // Developer

const LOG_CHANNEL_ID = "1465725426704977981";
const WELCOME_CHANNEL_ID = "1465721058991538197";
const AUTO_ROLE_ID = "1466047773161033885";

/* ========================================== */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel]
});

/* ================= FILTERS ================= */

const badWords = ["fuck","shit","nigger","nigga","faggot","retard","cunt"];
const linkRegex = /(https?:\/\/|www\.|discord\.gg|discord\.com\/invite|youtube\.com|youtu\.be)/i;

/* ================= READY ================= */

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.guilds.cache.forEach(g => {
    if (g.id !== ALLOWED_GUILD_ID) g.leave();
  });
});

/* ================= WELCOME + AUTOROLE ================= */

client.on("guildMemberAdd", async (member) => {
  if (member.guild.id !== ALLOWED_GUILD_ID) return;

  await member.roles.add(AUTO_ROLE_ID).catch(() => {});
  const ch = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("👋 Welcome to Yap Sites!")
    .setDescription(
      `Welcome **${member.user.username}**!\n\n👥 Members now: **${member.guild.memberCount}**`
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setTimestamp();

  ch.send({ embeds: [embed] });
});

/* ================= MESSAGE HANDLER ================= */

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;
  if (message.guild.id !== ALLOWED_GUILD_ID) return;

  const content = message.content.toLowerCase();

  /* ---- Anti Advertising (ADMIN ONLY ALLOWED) ---- */
  if (linkRegex.test(content)) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      await message.delete().catch(() => {});
      const warn = await message.channel.send(
        `🚫 ${message.author}, advertising is not allowed.`
      );
      setTimeout(() => warn.delete().catch(() => {}), 5000);
      return;
    }
  }

  /* ---- Anti Swear ---- */
  if (badWords.some(w => content.includes(w))) {
    await message.delete().catch(() => {});
    await message.member.timeout(5 * 60 * 1000, "Swearing");
    const warn = await message.channel.send(
      `🤬 ${message.author} muted for swearing.`
    );
    setTimeout(() => warn.delete().catch(() => {}), 5000);
    return;
  }

  if (!content.startsWith(PREFIX)) return;
  const args = content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift();

  /* ================= TICKET PANEL ================= */

  if (cmd === "ticketpanel") {
    await message.delete().catch(() => {});

    const embed = new EmbedBuilder()
      .setTitle("🎟️ Open a Ticket")
      .setDescription("What would you like your website to be about?")
      .setColor(0x5865f2);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`web_${message.author.id}`).setLabel("🌐 Website Idea").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`feat_${message.author.id}`).setLabel("⚙️ Features").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`part_${message.author.id}`).setLabel("🤝 Partnership").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`apply_${message.author.id}`).setLabel("🧑‍💼 Staff Apply").setStyle(ButtonStyle.Danger)
    );

    const panel = await message.channel.send({ embeds: [embed], components: [row] });
    setTimeout(() => panel.delete().catch(() => {}), 120000);
  }

  /* ================= GIVEAWAYS ================= */

  if (cmd === "gstart") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
    const minutes = parseInt(args.shift());
    const winners = parseInt(args.shift());
    const prize = args.join(" ");
    if (!minutes || !winners || !prize) return;

    const embed = new EmbedBuilder()
      .setTitle("🎉 GIVEAWAY 🎉")
      .setDescription(`🎁 **Prize:** ${prize}\n🏆 **Winners:** ${winners}\n⏰ Ends in ${minutes} minutes`)
      .setColor(0xffc107);

    const msg = await message.channel.send({ embeds: [embed] });
    await msg.react("🎉");

    setTimeout(async () => {
      const fetched = await msg.fetch();
      const users = (await fetched.reactions.cache.get("🎉").users.fetch())
        .filter(u => !u.bot);
      if (!users.size) return message.channel.send("❌ No valid entries.");
      const picked = users.random(winners);
      message.channel.send(`🎉 Winner(s): ${picked} — **${prize}**`);
    }, minutes * 60000);
  }

  if (cmd === "greroll") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
    const id = args[0];
    if (!id) return message.reply("❌ Provide giveaway message ID.");

    try {
      const gMsg = await message.channel.messages.fetch(id);
      const users = (await gMsg.reactions.cache.get("🎉").users.fetch())
        .filter(u => !u.bot);
      if (!users.size) return message.reply("❌ No participants.");
      const winner = users.random();
      message.channel.send(`🔁 **REROLL WINNER:** ${winner} 🎉`);
    } catch {
      message.reply("❌ Invalid message ID.");
    }
  }
});

/* ================= BUTTON HANDLER ================= */

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.guild.id !== ALLOWED_GUILD_ID) return;

  if (interaction.customId === "close_ticket") {
    client.channels.cache.get(LOG_CHANNEL_ID)
      ?.send(`🔒 Ticket closed → ${interaction.channel.name}`);
    return interaction.channel.delete();
  }

  const [type, ownerId] = interaction.customId.split("_");
  if (interaction.user.id !== ownerId) {
    return interaction.reply({ content: "❌ Not your panel.", ephemeral: true });
  }

  await interaction.message.delete().catch(() => {});

  const channel = await interaction.guild.channels.create({
    name: `ticket-${type}-${interaction.user.username}`,
    parent: TICKET_CATEGORY_ID,
    permissionOverwrites: [
      { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      { id: STAFF_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      { id: DEV_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
    ]
  });

  const closeBtn = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("close_ticket").setLabel("🔒 Close Ticket").setStyle(ButtonStyle.Danger)
  );

  await channel.send({
    content: `👋 Hello ${interaction.user}\nTell us more about your request.\n\n<@&${STAFF_ROLE_ID}> <@&${DEV_ROLE_ID}>`,
    components: [closeBtn]
  });

  interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });

  client.channels.cache.get(LOG_CHANNEL_ID)
    ?.send(`🎟️ Ticket created by ${interaction.user} → ${channel}`);
});

/* ================= MESSAGE LOGS ================= */

client.on("messageDelete", (msg) => {
  if (!msg.guild || msg.guild.id !== ALLOWED_GUILD_ID || !msg.content) return;
  client.channels.cache.get(LOG_CHANNEL_ID)
    ?.send(`🗑️ Deleted | ${msg.author} | ${msg.channel}\n${msg.content}`);
});

client.on("messageUpdate", (o, n) => {
  if (!o.guild || o.guild.id !== ALLOWED_GUILD_ID) return;
  if (o.content === n.content) return;
  client.channels.cache.get(LOG_CHANNEL_ID)
    ?.send(`✏️ Edited | ${o.author}\nBefore: ${o.content}\nAfter: ${n.content}`);
});

/* ================= LOGIN ================= */

client.login(process.env.TOKEN);
