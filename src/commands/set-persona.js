import { updateThread, getThread } from '../storage/thread-store.js';

export default {
  name: 'persona',
  description: 'Change the bot persona for this thread',
  usage: '.persona <text> | .persona reset | .persona show',
  minRole: 'admin', // Admins can change in groups, users in DMs (brain logic handles this)
  handler: async (ctx) => {
    const { api, event, args, config } = ctx;
    const { threadID } = event;

    if (!args[0]) {
      return api.sendMessage(`[Marie] Usage: ${config.prefix}persona <text> | reset | show`, threadID);
    }

    const sub = args[0].toLowerCase();

    if (sub === 'reset') {
      updateThread(threadID, { persona: null });
      return api.sendMessage("[Marie] Persona reset to default (Anya Forger).", threadID);
    }

    if (sub === 'show') {
      const thread = getThread(threadID);
      const persona = thread.persona || config.rp.defaultPersona;
      return api.sendMessage(`[Marie] Current Persona:\n\n${persona}`, threadID);
    }

    const newPersona = args.join(' ');
    updateThread(threadID, { persona: newPersona });
    api.sendMessage("[Marie] Persona updated successfully for this thread.", threadID);
  }
};
