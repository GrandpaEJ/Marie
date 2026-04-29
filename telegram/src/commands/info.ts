import { IMarieContext } from '@marie/brain';

export default {
  name: 'info',
  description: 'Get information about this chat',
  handler: async (ctx: IMarieContext) => {
    const { event, platform } = ctx;
    
    try {
      const threadInfo = await platform.getThreadInfo(event.threadID);
      const userInfo = await platform.getUserInfo(event.senderID);
      
      let msg = `ℹ️ *Chat Info*\n`;
      msg += `• *Chat Name*: ${threadInfo.title || threadInfo.displayName || 'Private Chat'}\n`;
      msg += `• *Chat ID*: \`${event.threadID}\`\n`;
      msg += `• *User*: ${userInfo.name} (\`${event.senderID}\`)\n`;
      msg += `• *Type*: ${event.isGroup ? 'Group' : 'Private'}\n`;
      
      await ctx.reply(msg);
    } catch (error: any) {
      await ctx.reply(`Error fetching info: ${error.message}`);
    }
  }
};
