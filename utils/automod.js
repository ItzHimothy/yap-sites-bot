const scamWords = [
  "free nitro",
  "steam gift",
  "airdrop",
  "crypto giveaway",
  "claim now",
  "verify account",
  "click this link",
];

const inviteRegex = /(discord\.gg|discord\.com\/invite)/i;
const youtubeRegex = /(youtube\.com|youtu\.be)/i;

const userSpamMap = new Map();

module.exports = async (message, client) => {
  if (!message.guild) return;
  if (message.author.bot) return;

  // Skip ticket channels
  if (message.channel.name.startsWith("ticket-")) return;

  const content = message.content.toLowerCase();

  /* =====================
     INVITE BLOCK
  ===================== */
  if (inviteRegex.test(content)) {
    await message.delete().catch(() => {});
    return message.channel.send({
      content: `🚫 ${message.author}, Discord invites are not allowed.`,
    });
  }

  /* =====================
     YOUTUBE BLOCK
  ===================== */
  if (youtubeRegex.test(content)) {
    await message.delete().catch(() => {});
    return message.channel.send({
      content: `🚫 ${message.author}, YouTube links are not allowed.`,
    });
  }

  /* =====================
     SCAM WORDS
  ===================== */
  for (const word of scamWords) {
    if (content.includes(word)) {
      await message.delete().catch(() => {});
      return message.channel.send({
        content: `⚠️ ${message.author}, scam-like content is not allowed.`,
      });
    }
  }

  /* =====================
     ANTI CAPS (70%)
  ===================== */
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
     ANTI SPAM
  ===================== */
  const now = Date.now();
  const userData = userSpamMap.get(message.author.id) || {
    count: 0,
    last: now,
  };

  if (now - userData.last < 4000) {
    userData.count++;
    if (userData.count >= 5) {
      await message.delete().catch(() => {});
      userSpamMap.delete(message.author.id);
      return message.channel.send({
        content: `⚠️ ${message.author}, stop spamming.`,
      });
    }
  } else {
    userData.count = 1;
  }

  userData.last = now;
  userSpamMap.set(message.author.id, userData);
};
