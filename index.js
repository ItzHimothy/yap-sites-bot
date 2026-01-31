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
const STAFF_ROLE_ID = "1466320528670195895";
const DEV_ROLE_ID = "1466321400553017525";

const LOG_CHANNEL_ID = "1465725426704977981";
const WELCOME_CHANNEL_ID = "1465721058991538197";
const AUTO_ROLE_ID = "1466047773161033885";

/* ========================================== */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

/* ================= INVITES ================= */

const invitesCache = new Map();

/* ================= FILTERS ================= */

const badWords = ["fuck","shit","nigger","nigga","faggot","retard","cunt"];
const linkRegex = /(https?:\/\/|www\.|discord\.gg|discord\.com\/invite|youtube\.com|youtu\.be)/i;

/* ================= READY ================= */

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  for (const guild of client.guilds.cache.values()) {
    if (guild.id !== ALLOWED_GUILD_ID) {
      await guild.leave();
      continue;
    }

    const invites = await guild.invites.fetch().catch(() => null);
    if (invites) invitesCache.set(guild.id, invites);
  }
});

/* ================= WELCOME + INVITES ================= */

client.on("guildMemberAdd", async (member) => {
  if (member.guild.id !== ALLOWED_GUILD_ID) return;

  await member.roles.add(AUTO_ROLE_ID).catch(() => {});

  let inviterText = "Vanity / Discovery";

  const oldInvites = invitesCache.get(member.guild.id);
  const newInvites = await member.guild.invites.fetch().catch(() => null);
  invitesCache.set(member.guild.id, newInvites);

  if (oldInvites && newInvites) {
    const usedInvite = newInvites.find(
      i => (oldInvites.get(i.code)?.uses ?? 0) < (i.uses ?? 0)
    );
    if (usedInvite?.inviter) {
      inviterText = usedInvite.inviter.tag;
    }
  }

  const welcome = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
  if (welcome) {
    welcome.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("👋 Welcome to Yap Sites!")
          .setDescription(
            `Welcome **${member.user.username}**!\n📩 Invited by: **${inviterText}**`
          )
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
          .setTimestamp()
      ]
    });
  }

  client.channels.cache.get(LOG_CHANNEL_ID)
    ?.send(`📥 **${member.user.tag} joined**\n📩 Invited by: **${inviterText}**`);
});

/* ================= MESSAGE HANDLER ================= */

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;
  if (message.guild.id !== ALLOWED_GUILD_ID) return;

  const content = message.content.toLowerCase();

  /* ---- Anti Ads ---- */
  if (linkRegex.test(content)) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      await message.delete().catch(() => {});
      return message.channel.send(`🚫 ${message.author}, advertising is not allowed.`)
        .then(m => setTimeout(() => m.delete(), 5000));
    }
  }

  /* ---- Anti Swear ---- */
  if (badWords.some(w => content.includes(w))) {
    await message.delete().catch(() => {});
    await message.member.timeout(5 * 60 * 1000, "Swearing").catch(() => {});
    return;
  }

  if (!content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift()?.toLowerCase();

  /* ================= TICKET PANEL (ADMIN ONLY) ================= */

  if (cmd === "ticketpanel") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return message.reply("❌ Admin only.");

    await message.delete().catch(() => {});

    const embed = new EmbedBuilder()
      .setTitle("🎟️ Open a Ticket")
      .setDescription("What would you like your website to be about?")
      .setColor(0x5865f2);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`web_${message.author.id}`).setLabel("🌐 Website").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`apply_${message.author.id}`).setLabel("🧑‍💼 Staff Apply").setStyle(ButtonStyle.Danger)
    );

    message.channel.send({ embeds: [embed], components: [row] });
  }
});

/* ================= BUTTON HANDLER ================= */

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.guild.id !== ALLOWED_GUILD_ID) return;

  const [type, ownerId] = interaction.customId.split("_");

  if (interaction.user.id !== ownerId)
    return interaction.reply({ content: "❌ Not your panel.", ephemeral: true });

  // ONE TICKET PER USER
  const existing = interaction.guild.channels.cache.find(
    c =>
      c.parentId === TICKET_CATEGORY_ID &&
      c.permissionOverwrites.cache.has(interaction.user.id)
  );

  if (existing) {
    return interaction.reply({
      content: `❌ You already have an open ticket: ${existing}`,
      ephemeral: true
    });
  }

  await interaction.message.delete().catch(() => {});

  const channel = await interaction.guild.channels.create({
    name: `ticket-${interaction.user.username}`.toLowerCase(),
    parent: TICKET_CATEGORY_ID,
    permissionOverwrites: [
      { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      { id: STAFF_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      { id: DEV_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
    ]
  });

  const closeBtn = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("close_ticket")
      .setLabel("🔒 Close Ticket")
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({
    content: `👋 Hello ${interaction.user}\nPlease describe your request.\n<@&${STAFF_ROLE_ID}>`,
    components: [closeBtn]
  });

  interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
});

/* ================= LOGIN ================= */

client.login(process.env.TOKEN);
