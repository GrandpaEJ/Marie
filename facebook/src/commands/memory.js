import {
  getFacts,
  getSummaries,
  clearThreadMemory,
  deleteAllFacts,
  deleteFact,
  countActiveMessages,
  initStorage
} from '@marie/memory';
import db from '../storage/db.js';

// Ensure storage is initialized with main DB
initStorage(db);

export default {
  name: 'memory',
  aliases: ['mem'],
  description: 'Manage AI long-term and short-term memory',
  commandCategory: 'ai',
  usage: '.memory facts [uid] | .memory summaries | .memory clear | .memory forget <id>',
  minRole: 'owner',
  handler: async (ctx) => {
    const { api, event, args, user, config } = ctx;
    const { threadID, senderID } = event;

    if (!args[0]) {
      return api.sendMessage(`[Marie Memory]\nUsage:\n  .memory facts [uid]\n  .memory summaries\n  .memory stats\n  .memory clear\n  .memory forget <fact_id>`, threadID);
    }

    const sub = args[0].toLowerCase();

    if (sub === 'facts') {
      const targetUid = args[1] || senderID;
      const facts = getFacts(targetUid);

      if (facts.length === 0) {
        return api.sendMessage(`[Marie] No facts stored for user ${targetUid}.`, threadID);
      }

      let msg = `[Marie Memory — Facts for ${targetUid}]\n\n`;
      const grouped = {};
      for (const f of facts) {
        if (!grouped[f.category]) grouped[f.category] = [];
        grouped[f.category].push(`  #${f.id} ${f.fact_key}: ${f.fact_value}`);
      }
      for (const [cat, items] of Object.entries(grouped)) {
        msg += `📁 ${cat.toUpperCase()}\n${items.join('\n')}\n\n`;
      }
      msg += `Total: ${facts.length} facts`;
      return api.sendMessage(msg, threadID);
    }

    if (sub === 'summaries' || sub === 'ltm') {
      const summaries = getSummaries(threadID, 10);

      if (summaries.length === 0) {
        return api.sendMessage(`[Marie] No LTM summaries for this thread.`, threadID);
      }

      let msg = `[Marie Memory — LTM Summaries]\n\n`;
      for (const s of summaries) {
        const date = new Date(s.from_timestamp * 1000).toLocaleDateString();
        msg += `📝 [${date}] (${s.msg_count} msgs)\n${s.summary}\n\n`;
      }
      return api.sendMessage(msg, threadID);
    }

    if (sub === 'stats') {
      const activeCount = countActiveMessages(threadID);
      const summaries = getSummaries(threadID, 100);
      const facts = getFacts(senderID);

      let msg = `[Marie Memory Stats]\n\n`;
      msg += `🧠 STM: ${activeCount} active messages\n`;
      msg += `📚 LTM: ${summaries.length} summaries\n`;
      msg += `📋 Facts: ${facts.length} facts about you\n`;
      return api.sendMessage(msg, threadID);
    }

    if (sub === 'clear') {
      clearThreadMemory(threadID);
      return api.sendMessage(`[Marie] All memory cleared for this thread (STM + LTM). User facts preserved.`, threadID);
    }

    if (sub === 'clearfacts') {
      const targetUid = args[1] || senderID;
      if (user.role !== 'owner' && targetUid !== senderID) {
        return api.sendMessage("[Marie] You can only clear your own facts.", threadID);
      }
      deleteAllFacts(targetUid);
      return api.sendMessage(`[Marie] All facts cleared for user ${targetUid}.`, threadID);
    }

    if (sub === 'forget') {
      const factId = parseInt(args[1]);
      if (isNaN(factId)) {
        return api.sendMessage("[Marie] Please provide a valid fact ID. Use .memory facts to see IDs.", threadID);
      }
      deleteFact(factId);
      return api.sendMessage(`[Marie] Fact #${factId} deleted.`, threadID);
    }

    api.sendMessage(`[Marie] Unknown subcommand. Use .memory for help.`, threadID);
  }
};
