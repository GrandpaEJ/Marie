export default {
  name: 'uid',
  description: 'Get your Telegram User ID',
  handler: async (ctx) => {
    const { event } = ctx;
    await ctx.reply(`Your ID: \`${event.senderID}\``);
  }
};
