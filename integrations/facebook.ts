/**
 * facebook.ts
 * Facebook Messenger adapter for Marie — powered by Bun-FCA.
 * 
 * This integration enables real-time messaging via MQTT, allowing Marie agents
 * to communicate directly on Facebook Messenger.
 */

// @ts-ignore - bun-fca is a JS module in a subdirectory
import login from '../bun-fca/index.js';
import type { Agent } from '../src/agent.ts';

export interface FacebookOptions {
  /** Valid Facebook appstate (array or JSON string) */
  appState: any;
  /** Only respond to messages from these thread IDs (empty for public) */
  allowedThreadIds?: string[];
  /** Custom welcome message for new conversations */
  startMessage?: string;
  /** Automatically mark messages as read */
  autoMarkRead?: boolean;
  /** Automatically mark messages as delivered */
  autoMarkDelivery?: boolean;
  /** Map Facebook User IDs to specific Marie names (optional) */
  userMap?: Record<string, string>;
}

export function facebookAdapter(agent: Agent, opts: FacebookOptions): Promise<{ stop(): void }> {
  const allowed = opts.allowedThreadIds ?? [];
  const startMsg = opts.startMessage ?? "👋 Hello! I'm Marie, your AI assistant on Messenger.";
  const autoRead = opts.autoMarkRead ?? true;
  const autoDeliv = opts.autoMarkDelivery ?? true;

  return new Promise((resolve, reject) => {
    login({ appState: opts.appState }, (err: any, api: any) => {
      if (err) {
        console.error('[facebook] Initialization failed:', err);
        return reject(err);
      }

      // Configure API
      api.setOptions({
        listenEvents: true,
        selfListen: false,
        autoMarkRead: autoRead,
        autoMarkDelivery: autoDeliv
      });

      console.log('[facebook] Adapter connected — Listening for messages via MQTT');

      const stopListening = api.listenMqtt(async (err: any, event: any) => {
        if (err) {
          console.error('[facebook] Listen error:', err);
          return;
        }

        if (event.type !== 'message' && event.type !== 'message_reply') return;

        const { threadID, senderID, body, messageID } = event;
        const text = (body || '').trim();

        if (!text) return;

        // Authorization check
        if (allowed.length > 0 && !allowed.includes(threadID)) {
          // Silent ignore for unauthorized threads
          return;
        }

        // Basic commands
        if (text.toLowerCase() === '/start') {
          return api.sendMessage(startMsg, threadID);
        }

        if (text.toLowerCase() === '/clear') {
          // Note: Marie handles history via metadata/userId in MemoryMiddleware if configured
          return api.sendMessage('🧹 Context reset requested (if supported by agent memory).', threadID);
        }

        try {
          // 1. Show typing indicator
          api.sendTypingIndicator(true, threadID);

          // 2. Process through Marie Agent
          // We pass threadID as userId to scope the memory/history correctly
          const chatOpts = {
            metadata: { 
              userId: String(threadID),
              senderId: String(senderID),
              source: 'facebook',
              messageId: messageID
            }
          };

          let accumulated = '';
          let lastTypingUpdate = Date.now();

          for await (const chunk of agent.chat(text, chatOpts)) {
            accumulated += chunk;
            
            // Periodically refresh typing indicator for long responses
            if (Date.now() - lastTypingUpdate > 5000) {
              api.sendTypingIndicator(true, threadID);
              lastTypingUpdate = Date.now();
            }
          }

          // 3. Send final response
          // Messenger limit is ~2000 chars per message. Marie handles slicing if needed? 
          // For now, we send the whole chunk if it's reasonable.
          if (accumulated.trim()) {
            api.sendMessage(accumulated, threadID);
          }

        } catch (chatErr) {
          console.error('[facebook] Chat error:', chatErr);
          const errMsg = chatErr instanceof Error ? chatErr.message : 'An error occurred while processing your request.';
          api.sendMessage(`❌ Error: ${errMsg}`, threadID);
        } finally {
          // 4. Stop typing indicator
          api.sendTypingIndicator(false, threadID);
        }
      });

      // Provide a way to stop the adapter
      resolve({
        stop() {
          if (typeof stopListening === 'function') {
            stopListening();
          }
          console.log('[facebook] Adapter stopped');
        }
      });
    });
  });
}
