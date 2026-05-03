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
        console.log(`[Chat] Incoming message from ${senderID}: ${body}`);
        await api.sendTypingIndicator(true, threadID);
        try {
            const mm = getMemoryManager(config);
            const tools = skills ? skills.getOpenAITools() : [];
            const { messages, model } = mm.buildContext(threadID, senderID, senderName, body, tools, config.llm?.defaultModel);
            
            console.log(`[Chat] Starting Agentic Loop (${model}) for ${senderID}...`);
            
            const agentResult = await runAgentLoop(ctx, messages, tools, llm, config);
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
            console.error("Chat handler error:", error);
            try {
                // Mask sensitive info like API keys in error message
                let errMsg = error.message;
                
                // Mask OpenRouter/OpenAI keys
                errMsg = errMsg.replace(/sk-[a-zA-Z0-8]{20,}/g, 'sk-***');
                
                // Truncate error message to avoid MESSAGE_TOO_LONG
                const finalMsg = errMsg.length > 500 ? errMsg.slice(0, 500) + "..." : errMsg;
                
                await api.sendMessage(`[Marie] Chat error: ${finalMsg}`, threadID);
            } catch (err) {
                console.error("Failed to send error message to Telegram:", err.message);
            }
        }
        finally {
            await api.sendTypingIndicator(false, threadID);
        }
    }
};
