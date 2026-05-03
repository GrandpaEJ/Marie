/**
 * Toggles debug mode for the current user/session.
 */
export default {
  name: 'debug',
  description: 'Toggle debug mode to see internal thoughts and agentic reasoning.',
  minRole: 'owner',
  handler: async (ctx) => {
    const { reply, args, user } = ctx;
    
    if (args[0] === 'on') {
      user.debug = true;
      await reply('✅ **Debug Mode ON**. You will now see <thought> and <plan> tags.');
    } else if (args[0] === 'off') {
      user.debug = false;
      await reply('❌ **Debug Mode OFF**. Thoughts and plans are now hidden.');
    } else {
      await reply(`Current debug mode: ${user.debug ? 'ON' : 'OFF'}\nUsage: .debug on/off`);
    }
  }
};
