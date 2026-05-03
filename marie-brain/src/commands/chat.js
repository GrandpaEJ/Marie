import { MemoryManager } from '@marie/memory';
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
            const { messages, model } = mm.buildContext(threadID, senderID, senderName, body);
            const tools = skills ? skills.getOpenAITools() : [];
            console.log(`[Chat] Calling LLM (${model}) with ${messages.length} messages and ${tools.length} tools...`);
            let response = await llm.chat(messages, {
                model: model,
                fallbackModel: config.llm.fallbackModel,
                temperature: config.llm.temperature,
                tools: tools.length > 0 ? tools : undefined
            });
            // --- Tool Handling Loop ---
            let toolCallCount = 0;
            const MAX_TOOL_CALLS = 5;
            const toolResultsHistory = []; // Track tool results to extract images if final response is empty
            while (toolCallCount < MAX_TOOL_CALLS) {
                // 1. Check for native tool calls
                let currentToolCalls = response.toolCalls || [];
                // 2. Check for Hallucinated/Text-based Tool Calls (Fallback for weaker models)
                if (currentToolCalls.length === 0) {
                    const content = response.content?.trim();
                    if (content && (content.includes('TOOLCALL>') || content.startsWith('{') || content.startsWith('['))) {
                        console.log(`[Chat] Detected potential tool call in content...`);
                        try {
                            let jsonPart = content;
                            if (content.includes('TOOLCALL>')) {
                                jsonPart = content.split('TOOLCALL>')[1].trim();
                            }
                            // Extract the most likely JSON block
                            const jsonMatch = jsonPart.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
                            if (jsonMatch) {
                                const parsed = JSON.parse(jsonMatch[0]);
                                const toolArray = Array.isArray(parsed) ? parsed : [parsed];
                                // Validate that it looks like a tool call
                                if (toolArray.length > 0 && (toolArray[0].name || toolArray[0].function)) {
                                    currentToolCalls = toolArray.map((t, i) => ({
                                        id: `hallucinated_${Date.now()}_${i}`,
                                        type: 'function',
                                        function: {
                                            name: t.name || t.function?.name,
                                            arguments: typeof t.arguments === 'string' ? t.arguments : JSON.stringify(t.arguments || t.function?.arguments || {})
                                        }
                                    }));
                                    // Clear the content so we don't print the raw tool call
                                    response.content = content.split(/TOOLCALL>|\[|\{/)[0].trim();
                                }
                            }
                        }
                        catch (e) {
                            console.warn('[Chat] Failed to parse hallucinated tool call:', e.message);
                        }
                    }
                }
                if (currentToolCalls.length === 0)
                    break;
                toolCallCount++;
                console.log(`[Chat] Iteration ${toolCallCount}: Processing ${currentToolCalls.length} tool calls...`);
                // Add assistant turn to history
                // Use null for content if empty to be more compliant with some APIs
                messages.push({
                    role: 'assistant',
                    content: response.content || null,
                    tool_calls: currentToolCalls
                });
                for (const toolCall of currentToolCalls) {
                    const { name, arguments: argsString } = toolCall.function;
                    let toolResult;
                    try {
                        const args = JSON.parse(argsString);
                        console.log(`[Chat] Tool Request: ${name}`, args);
                        toolResult = await skills.callTool(name, args, { threadID, senderID });
                        toolResultsHistory.push(toolResult);
                        console.log(`[Chat] Tool Result (${name}):`, JSON.stringify(toolResult).slice(0, 200) + '...');
                    }
                    catch (err) {
                        console.error(`[Chat] Tool Error (${name}):`, err.message);
                        toolResult = { success: false, error: err.message };
                    }
                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        name: name,
                        content: JSON.stringify(toolResult)
                    });
                }
                // Call LLM again
                response = await llm.chat(messages, {
                    model: model,
                    temperature: config.llm.temperature,
                    tools: tools.length > 0 ? tools : undefined
                });
            }
            console.log(`[Chat] Final response received (${response.content?.length || 0} chars).`);
            // If response is empty but we have tool results, check if we can synthesize a response
            if ((!response.content || response.content.length === 0) && toolResultsHistory.length > 0) {
                console.log('[Chat] Response empty after tools. Attempting to extract images/urls from tool results...');
                // Extract URLs from tool results to show something at least
                const urls = [];
                const findUrls = (obj) => {
                    if (typeof obj === 'string' && (obj.startsWith('http') && (obj.includes('.jpg') || obj.includes('.png') || obj.includes('.gif') || obj.includes('imgur.com')))) {
                        urls.push(obj);
                    }
                    else if (obj && typeof obj === 'object') {
                        Object.values(obj).forEach(v => findUrls(v));
                    }
                };
                toolResultsHistory.forEach(res => findUrls(res));
                if (urls.length > 0) {
                    response.content = urls.map(u => `![image](${u})`).join('\n');
                    console.log(`[Chat] Synthesized response with ${urls.length} images.`);
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
