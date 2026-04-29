import { IMarieContext } from '@marie/brain';

export default {
  name: 'start',
  description: 'Start the bot and get a welcome message',
  handler: async (ctx: IMarieContext) => {
    const { user, config } = ctx;
    const botName = config.botName || 'Marie';
    await ctx.reply(`Waku waku! Hello ${user.name || 'there'}, I am ${botName}! Type .help to see what I can do.`);
  }
};
