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

/* ================= SERVER LOCK ================= */

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  for (const guild of client.guilds.cache.values()) {
    if (guild.id !== ALLOWED_GUILD_ID) {
      await guild.leave().catch(() => {});
      continue;
    }

    // Cache invites on startup
    const invites = await guild.invites.fetch().catch(() => null);
    if (invites) invitesCache.set(guild.id, invites);
  }
});

/* ================= INVITES ================= */

const invitesCache = new Map();

/* ================= FILTERS ================= */

const badWords = ["fuck","shit","nigger","nigga","faggot","retard","cunt"];
const linkRegex = /(https?:\/\/|www\.|discord\.gg|discord\.com\/invite|youtube\.com|youtu\.be)/i;

/* ================= GIVEAWAYS ================= */
/**
 * giveaways map:
 * key: giveaway message id
 * value: { channelId, winnersCount, prize, ended, winners: [userId,...] }
 */
const giveaways = new Map();

function parseDuration(input) {
  if (!input) return null;

  // supports: 10m / 2h / 1d
  const match = String(input).match(/^(\d+)(m|h|d)$/i);
  if (match) {
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    if (unit === "m") return value * 60 * 1000;
    if (unit === "h") return value * 60 * 60 * 1000;
    if (unit === "d") return value * 24 * 60 * 60 * 1000;
  }

  // legacy: "10" = 10 minutes
  const num = parseInt(input, 10);
  if (!Number.isNaN(num) && num > 0) return num * 60 * 1000;

  return null;
}

async function safeSend(channel, payload, fallbackText) {
  try {
    return await channel.send(payload);
  } catch (e) {
    try {
      return await channel.send({ content: fallbackText || "⚠️ Failed to send embed. (Missing Embed Links permission?)" });
    } catch {}
  }
  return null;
}

async function endGiveaway(messageId, forced = false) {
  const data = giveaways.get(messageId);
  if (!data) return { ok: false, reason: "NOT_FOUND" };
  if (data.ended && !forced) return { ok: false, reason: "ALREADY_ENDED" };

  const channel = await client.channels.fetch(data.channelId).catch(() => null);
  if (!channel) return { ok: false, reason: "CHANNEL_NOT_FOUND" };

  const msg = await channel.messages.fetch(messageId).catch(() => null);
  if (!msg) return { ok: false, reason: "MESSAGE_NOT_FOUND" };

  const reaction = msg.reactions.cache.get("🎉");
  if (!reaction) {
    data.ended = true;
    giveaways.set(messageId, data);
    await channel.send("❌ Giveaway ended — no 🎉 reaction found.");
    return { ok: true, winners: [] };
  }

  const users = (await reaction.users.fetch()).filter(u => !u.bot);

  // eligible = not already won before
  const eligible = users.filter(u => !data.winners.includes(u.id));

  if (!eligible.size) {
    data.ended = true;
    giveaways.set(messageId, data);
    await channel.send("❌ Giveaway ended — no valid participants.");
    return { ok: true, winners: [] };
  }

  const count = Math.min(data.winnersCount, eligible.size);
  const picked = eligible.random(count);
  const pickedArr = Array.isArray(picked) ? picked : [picked];

  data.winners.push(...pickedArr.map(u => u.id));
  data.ended = true;
  giveaways.set(messageId, data);

  await channel.send(
    `⏹️ **GIVEAWAY ENDED**\n🏆 Winner(s): ${pickedArr.map(u => `<@${u.id}>`).join(", ")}\n🎁 **${data.prize}**`
  );

  return { ok: true, winners: pickedArr.map(u => u.id) };
}

/* ================= WELCOME + INVITES ================= */

client.on("guildMemberAdd", async (member) => {
  if (member.guild.id !== ALLOWED_GUILD_ID) return;

  // autorole
  await member.roles.add(AUTO_ROLE_ID).catch(() => {});

  // invite tracking
  let inviterText = "Vanity / Discovery";

  const oldInvites = invitesCache.get(member.guild.id);
  const newInvites = await member.guild.invites.fetch().catch(() => null);
  if (newInvites) invitesCache.set(member.guild.id, newInvites);

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
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("👋 Welcome to Yap Sites!")
      .setDescription(
        `Welcome **${member.user.username}**!\n📩 Invited by: **${inviterText}**\n👥 Members now: **${member.guild.memberCount}**`
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    // safe send (in case embeds are blocked)
    await safeSend(
      welcome,
      { embeds: [embed] },
      `👋 Welcome to Yap Sites, **${member.user.username}**!\n📩 Invited by: **${inviterText}**\n👥 Members now: **${member.guild.memberCount}**`
    );
  }

  client.channels.cache.get(LOG_CHANNEL_ID)
    ?.send(`📥 **${member.user.tag} joined**\n📩 Invited by: **${inviterText}**`)
    .catch(() => {});
});

/* ================= MESSAGE HANDLER ================= */

client.on("messageCreate", async (message) => {
  try {
    if (!message.guild || message.author.bot) return;
    if (message.guild.id !== ALLOWED_GUILD_ID) return;

    const contentLower = message.content.toLowerCase();

    /* ---- Anti Ads (admins allowed) ---- */
    if (linkRegex.test(contentLower)) {
      if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        await message.delete().catch(() => {});
        const warn = await message.channel.send(`🚫 ${message.author}, advertising is not allowed.`);
        setTimeout(() => warn.delete().catch(() => {}), 5000);
        return;
      }
    }

    /* ---- Anti Swear -> 5 min timeout ---- */
    if (badWords.some(w => contentLower.includes(w))) {
      await message.delete().catch(() => {});
      await message.member.timeout(5 * 60 * 1000, "Swearing").catch(() => {});
      return;
    }

    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const cmd = (args.shift() || "").toLowerCase();

    /* ================= TICKET PANEL (ADMIN ONLY COMMAND) ================= */
    if (cmd === "ticketpanel") {
      if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply("❌ Admin only.");
      }

      await message.delete().catch(() => {});

      const embed = new EmbedBuilder()
        .setTitle("🎟️ Open a Ticket")
        .setDescription("Click a button to open a ticket.\n\n**Website:** Tell us what your website is about.\n**Staff Apply:** Apply for staff/mod.")
        .setColor(0x5865f2);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket_web").setLabel("🌐 Website").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("ticket_apply").setLabel("🧑‍💼 Staff Apply").setStyle(ButtonStyle.Danger)
      );

      // IMPORTANT: panel stays, NOT deleted
      await safeSend(
        message.channel,
        { embeds: [embed], components: [row] },
        "🎟️ Open a Ticket\nUse the buttons (Website / Staff Apply)."
      );
      return;
    }

    /* ================= GIVEAWAYS ================= */
    // !gstart 2h 1 Prize
    if (cmd === "gstart") {
      if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

      const durationInput = args.shift();
      const winnersCount = parseInt(args.shift(), 10);
      const prize = args.join(" ");

      const duration = parseDuration(durationInput);
      if (!duration || !winnersCount || !prize) {
        return message.reply("❌ Usage: `!gstart 10m 1 Prize` (m/h/d) or `!gstart 10 1 Prize` (10 minutes).");
      }

      const endUnix = Math.floor((Date.now() + duration) / 1000);

      const embed = new EmbedBuilder()
        .setTitle("🎉 GIVEAWAY 🎉")
        .setColor(0xffc107)
        .setDescription(
          `🎁 **Prize:** ${prize}\n🏆 **Winners:** ${winnersCount}\n⏰ **Ends:** <t:${endUnix}:R>\n\nReact with 🎉 to enter!`
        );

      const gwMsg = await safeSend(
        message.channel,
        { embeds: [embed] },
        `🎉 GIVEAWAY 🎉\nPrize: ${prize}\nWinners: ${winnersCount}\nEnds: <t:${endUnix}:R>\nReact with 🎉 to enter!`
      );

      if (!gwMsg) return; // couldn't send at all

      // React (if bot lacks add reactions, this will fail silently)
      await gwMsg.react("🎉").catch(() => {});

      giveaways.set(gwMsg.id, {
        channelId: message.channel.id,
        winnersCount,
        prize,
        ended: false,
        winners: []
      });

      setTimeout(() => endGiveaway(gwMsg.id).catch(() => {}), duration);
      return;
    }

    // !end <messageId>
    if (cmd === "end") {
      if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

      const id = args[0];
      if (!id) return message.reply("❌ Provide giveaway message ID.");

      const res = await endGiveaway(id, true);
      if (!res.ok && res.reason === "MESSAGE_NOT_FOUND") {
        return message.reply("❌ I can’t find that message in THIS channel. Run `!end` in the same channel as the giveaway.");
      }
      if (!res.ok && res.reason === "NOT_FOUND") {
        return message.reply("❌ Giveaway not found (maybe bot restarted).");
      }
      return;
    }

    // !greroll <messageId>
    if (cmd === "greroll") {
      if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

      const id = args[0];
      if (!id) return message.reply("❌ Provide giveaway message ID.");

      const data = giveaways.get(id);
      if (!data) return message.reply("❌ Giveaway not found (maybe bot restarted).");

      const channel = await client.channels.fetch(data.channelId).catch(() => null);
      if (!channel) return message.reply("❌ Giveaway channel not found.");

      const msg = await channel.messages.fetch(id).catch(() => null);
      if (!msg) return message.reply("❌ Invalid message ID (or not in this channel).");

      const reaction = msg.reactions.cache.get("🎉");
      if (!reaction) return message.reply("❌ No 🎉 reactions found.");

      const users = (await reaction.users.fetch()).filter(u => !u.bot);
      const eligible = users.filter(u => !data.winners.includes(u.id));

      if (!eligible.size) return message.reply("❌ No new users left to reroll.");

      const winner = eligible.random();
      data.winners.push(winner.id);
      giveaways.set(id, data);

      return channel.send(`🔁 **REROLL WINNER:** <@${winner.id}> 🎉`);
    }
  } catch (e) {
    console.error("messageCreate error:", e);
  }
});

/* ================= BUTTON HANDLER (TICKETS) ================= */

client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isButton()) return;
    if (!interaction.guild || interaction.guild.id !== ALLOWED_GUILD_ID) return;

    // Close ticket
    if (interaction.customId === "close_ticket") {
      client.channels.cache.get(LOG_CHANNEL_ID)
        ?.send(`🔒 Ticket closed → ${interaction.channel?.name || "unknown"}`)
        .catch(() => {});
      return interaction.channel.delete().catch(() => {});
    }

    // Ticket buttons
    if (interaction.customId !== "ticket_web" && interaction.customId !== "ticket_apply") return;

    // ONE TICKET PER USER
    const existing = interaction.guild.channels.cache.find(
      c =>
        c.parentId === TICKET_CATEGORY_ID &&
        c.permissionOverwrites?.cache?.has(interaction.user.id)
    );

    if (existing) {
      return interaction.reply({
        content: `❌ You already have an open ticket: ${existing}`,
        ephemeral: true
      });
    }

    const type = interaction.customId === "ticket_web" ? "website" : "apply";

    const channel = await interaction.guild.channels.create({
      name: `ticket-${type}-${interaction.user.username}`
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "")
        .slice(0, 90),
      parent: TICKET_CATEGORY_ID,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: STAFF_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: DEV_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
      ]
    });

    const closeBtn = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("close_ticket")
        .setLabel("🔒 Close Ticket")
        .setStyle(ButtonStyle.Danger)
    );

    const helloText =
      type === "website"
        ? `👋 Hello ${interaction.user}!\n**Answer this:** What would you like your website to be about?\nThen: what features do you want?`
        : `👋 Hello ${interaction.user}!\n**Staff Application:** Tell us your age, timezone, experience, and why you should be staff.`;

    await channel.send({
      content: `${helloText}\n\n<@&${STAFF_ROLE_ID}> <@&${DEV_ROLE_ID}>`,
      components: [closeBtn]
    });

    await interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });

    client.channels.cache.get(LOG_CHANNEL_ID)
      ?.send(`🎟️ Ticket created by ${interaction.user.tag} → ${channel}`)
      .catch(() => {});
  } catch (e) {
    console.error("interactionCreate error:", e);
  }
});

/* ================= LOGIN ================= */

client.login(process.env.TOKEN);
