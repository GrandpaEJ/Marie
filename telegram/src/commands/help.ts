import { IMarieContext } from '@marie/brain';

export default {
  name: 'help',
  description: 'Telegram specific help guide',
  handler: async (ctx: IMarieContext) => {
    // If we have a global help, we could just delegate, 
    // but the user specifically asked for these commands in the telegram folder.
    const { registry, config } = ctx;
    const prefix = config.prefix || '.';
    
    let msg = `🏠 *Marie Help (Telegram)*\n\n`;
    msg += `Available commands:\n`;
    
    const cmds = Array.from(registry.commands.values())
      .filter((c: any) => !c.hidden)
      .map((c: any) => `• \`${prefix}${c.name}\`: ${c.description || 'No description'}`);
    
    msg += cmds.join('\n');
    await ctx.reply(msg);
  }
};
