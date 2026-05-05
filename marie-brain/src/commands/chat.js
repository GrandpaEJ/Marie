import { MemoryManager } from '@marie/memory';
import { runAgentLoop } from '../core/agent-loop.js';
import db from '../storage/db.js';
import * as userStore from '../storage/user-store.js';
import * as threadStore from '../storage/thread-store.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import sharp from 'sharp';
import { fetch } from 'undici';
let memoryManager = null;
function getMemoryManager(config) {
    if (!memoryManager) {
        memoryManager = new MemoryManager(config, {
            db,
            userStore,
            threadStore
        });
    }
    return memoryManager;
}
export default {
    name: 'chat',
    description: 'Main RP chat handler with Multi-Mode Tool Support',
    commandCategory: 'ai',
    minRole: 'user', // Explicitly allow all users by default; change to 'admin' to restrict
    handler: async (ctx) => {
        const { api, event, llm, config, user, skills } = ctx;
        const { threadID, senderID, body, messageID } = event;
        const senderName = user?.name || event.senderName || null;

        // --- Smart Typing Indicator ---
        let isTyping = true;
        const typingLoop = async () => {
          while (isTyping) {
            try { await api.sendTypingIndicator(true, threadID); } catch (e) {}
            await new Promise(r => setTimeout(r, 4000));
          }
        };
        typingLoop();
        
        // --- Quick Fix: Explicit image command only (avoid keyword-based auto-images) ---
        const lowerBody = body.toLowerCase();
        const imageCommandMatch = lowerBody.match(/^\s*[./](img|image)\b\s*(.*)$/);
        if (imageCommandMatch && lowerBody.length < 200) {
          console.log(`[Chat] Image command triggered: ${body}`);
          const requestedText = (imageCommandMatch[2] || '').trim();
          
          const isNsfwRequested = lowerBody.includes('nsfw') || lowerBody.includes('hentai') || lowerBody.includes('lewd') || lowerBody.includes('ero') || lowerBody.includes('ass') || lowerBody.includes('milf') || lowerBody.includes('paizuri') || lowerBody.includes('ecchi');
          const nsfwAllowed = config.anime?.nsfwAllowed || config.anime?.nsfwThreads?.includes(threadID);
          
          if (isNsfwRequested && !nsfwAllowed) {
            isTyping = false;
            await api.sendTypingIndicator(false, threadID);
            await api.sendMessage("🌸 **Gomen!** I can't send NSFW content in this thread. Please keep it wholesome! 🌸", threadID, messageID);
            return;
          }

          let imageUrl = '';
          
          // Determine Category/Tag
          const tags = ['maid', 'waifu', 'marin-kitagawa', 'mori-calliope', 'raiden-shogun', 'oppai', 'selfies', 'uniform', 'kamisato-ayaka', 'hentai', 'ero', 'ass', 'milf', 'oral', 'paizuri', 'ecchi'];
          let category = 'neko';
          for (const tag of tags) {
            if (lowerBody.includes(tag.split('-')[0])) {
              category = tag;
              break;
            }
          }
          if (lowerBody.includes('neko')) category = 'neko';
          if (lowerBody.includes('kitsune')) category = 'kitsune';
          if (lowerBody.includes('shinobu')) category = 'shinobu';
          if (lowerBody.includes('megumin')) category = 'megumin';

          try {
            if (isNsfwRequested) {
              // Try waifu.im for NSFW
              const res = await fetch(`https://api.waifu.im/search?included_tags=${category}&is_nsfw=true`);
              const data = await res.json();
              if (data.images?.[0]?.url) {
                imageUrl = data.images[0].url;
              } else {
                const res2 = await fetch(`https://api.waifu.pics/nsfw/${category === 'neko' ? 'neko' : 'waifu'}`);
                const data2 = await res2.json();
                imageUrl = data2.url;
              }
            } else {
              // SFW: Try Waifu.im for specific tags first
              const waifuImTags = ['maid', 'waifu', 'marin-kitagawa', 'mori-calliope', 'raiden-shogun', 'oppai', 'selfies', 'uniform', 'kamisato-ayaka'];
              if (waifuImTags.includes(category)) {
                const res = await fetch(`https://api.waifu.im/search?included_tags=${category}`);
                const data = await res.json();
                imageUrl = data.images[0].url;
              } else {
                const res = await fetch(`https://nekos.best/api/v2/${category}`);
                const data = await res.json();
                imageUrl = data.results[0].url;
              }
            }
          } catch (e) {
            // Fallback to pollinations
            const promptBase = requestedText.length > 0 ? requestedText : body;
            const prompt = isNsfwRequested ? `nsfw anime ${promptBase}` : promptBase;
            imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&seed=${Math.floor(Math.random() * 1000000)}&nologo=true`;
          }
          
          isTyping = false;
          await api.sendTypingIndicator(false, threadID);
          await api.sendMessage({
            body: `🌸 **Waku waku!** Here is the ${isNsfwRequested ? 'lewd ' : ''}${category} you wanted:`,
            attachment: [imageUrl]
          }, threadID, messageID);
          return;
        }

        try {
            const mm = getMemoryManager(config);
            const tools = skills ? skills.getOpenAITools() : [];
            const { messages, model } = mm.buildContext(threadID, senderID, senderName, body, tools, config.llm?.defaultModel);
            
            console.log(`[Chat] Starting Agentic Loop (${model}) for ${senderID}...`);
            
            const agentResult = await runAgentLoop(ctx, messages, tools, llm, config);
            isTyping = false; // Stop typing after loop
            let response = agentResult.response;

            // --- Post-Loop Tag Filtering (Internal Monologue) ---
            if (response.content) {
                // If not owner/debug mode, strip thought/plan/reflection tags
                const isOwner = user?.role === 'owner';
                const showThoughts = (isOwner && (body.includes('--debug') || body.includes('--thoughts'))) || user?.debug;

                if (!showThoughts) {
                    response.content = response.content.replace(/<(thought|plan|reflection)>[\s\S]*?<\/\1>/g, '').trim();
                } else {
                    // Prettify thoughts for owner
                    response.content = response.content.replace(/<(thought|plan|reflection)>([\s\S]*?)<\/\1>/g, (m, tag, inner) => {
                        return `\n> **${tag.toUpperCase()}**: ${inner.trim()}\n`;
                    });
                }
            }

            // --- Image Extraction ---
            // (Keeping image extraction logic but using the messages from agent loop if content is empty)
            if (!response.content || response.content.length === 0) {
                console.log('[Chat] Response empty. Searching messages for tool-generated images...');
                const urls = [];
                const findUrls = (obj) => {
                    if (typeof obj === 'string' && (obj.startsWith('http') && (obj.includes('.jpg') || obj.includes('.png') || obj.includes('.gif') || obj.includes('imgur.com')))) {
                        urls.push(obj);
                    } else if (obj && typeof obj === 'object') {
                        Object.values(obj).forEach(v => findUrls(v));
                    }
                };
                messages.forEach(msg => {
                    if (msg.role === 'tool') {
                        try { findUrls(JSON.parse(msg.content)); } catch(e) {}
                    }
                });
                if (urls.length > 0) {
                    response.content = urls.map(u => `![image](${u})`).join('\n');
                }
            }

            await mm.afterResponse(threadID, senderID, body, response, llm);
            if (response.content && response.content.length > 0) {
                let contentToProcess = response.content;
                const attachments = [];
                const tempFiles = [];
                // 1. Extract markdown images: ![alt](url)
                const imageRegex = /!\[.*?\]\((.*?)\)/g;
                let match;
                const urlsToDownload = [];
                while ((match = imageRegex.exec(contentToProcess)) !== null) {
                    if (urlsToDownload.length < 5) { // 1-5 limit
                        urlsToDownload.push(match[1]);
                    }
                }
                // 2. Remove the markdown image syntax from the text to keep it clean
                let cleanText = contentToProcess.replace(/!\[.*?\]\((.*?)\)/g, '').trim();
                // 3. Download and optimize images if any
                if (urlsToDownload.length > 0) {
                    try {
                        await Promise.all(urlsToDownload.map(async (url) => {
                            const res = await fetch(url, {
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                                }
                            });
                            if (!res.ok)
                                throw new Error(`Failed to fetch ${url} - Status: ${res.status}`);
                            const buffer = Buffer.from(await res.arrayBuffer());
                            // Create temp file
                            const tempName = `marie_img_${crypto.randomBytes(4).toString('hex')}.jpg`;
                            const tempPath = path.join(os.tmpdir(), tempName);
                            // Optimize with sharp
                            await sharp(buffer)
                                .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
                                .jpeg({ quality: 85 })
                                .toFile(tempPath);
                            tempFiles.push(tempPath);
                            attachments.push(fs.createReadStream(tempPath));
                        }));
                    }
                    catch (e) {
                        console.error('[Chat] Image download/processing failed:', e.message);
                    }
                }
                // 4. Send Message (with or without attachments)
                if (cleanText.length > 2000) {
                    const chunks = cleanText.match(/[\s\S]{1,2000}/g) || [];
                    for (let i = 0; i < chunks.length; i++) {
                        const isLast = i === chunks.length - 1;
                        const payload = { body: chunks[i] };
                        if (isLast && attachments.length > 0) {
                            payload.attachment = attachments;
                        }
                        await api.sendMessage(payload, threadID, messageID);
                    }
                }
                else {
                    const payload = {};
                    if (cleanText.length > 0)
                        payload.body = cleanText;
                    if (attachments.length > 0)
                        payload.attachment = attachments;
                    if (Object.keys(payload).length > 0) {
                        await api.sendMessage(payload, threadID, messageID);
                    }
                }
                // 5. Cleanup temp files
                for (const file of tempFiles) {
                    try {
                        if (fs.existsSync(file))
                            fs.unlinkSync(file);
                    }
                    catch (e) { }
                }
            }
        }
        catch (error) {
            isTyping = false;
            console.error("Chat handler error:", error);
            try {
                let friendlyMsg = "⚠️ **Oops! Something went wrong.**\nI encountered a technical hiccup while processing your request. Please try again in a moment.";

                if (error.message.includes('all providers in fallback chain failed') || error.message.includes('502') || error.message.includes('429')) {
                    friendlyMsg = "🧠 **Marie's brain is a bit tired right now.**\nAll my AI providers are currently busy or unavailable. I'll be back to normal once they've had a rest! 🌸";
                } else if (error.message.includes('timeout')) {
                    friendlyMsg = "⏱️ **Request timed out.**\nIt took too long to think of a response. Maybe try a simpler question? 🌸";
                }

                await api.sendMessage(friendlyMsg, threadID, messageID);
            } catch (err) {
                console.error("Failed to send error message to Telegram:", err.message);
            }
        }
        finally {
            isTyping = false;
            await api.sendTypingIndicator(false, threadID);
        }
    }
};
