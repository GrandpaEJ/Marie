import fs from 'fs';

export class TGPlatform {
  name = 'telegram';

  constructor(client) {
    this.client = client;
    this.typingIntervals = new Map();
  }

  resolvePeer(id) {
    // If it looks like a number, convert it. If it starts with a letter, keep as string (username).
    if (/^-?\d+$/.test(id)) {
      return parseInt(id);
    }
    return id;
  }

  getSelfID() {
    const self = this.client.storage.self?.get?.();
    return self?.userId?.toString() || '';
  }

  async sendMessage(arg1, arg2, arg3) {
    // Handle both (threadID, text, replyTo) and (payload, threadID, replyTo)
    let threadID;
    let text;
    let replyTo;
    let attachments = [];

    if (typeof arg1 === 'string') {
      // IDs in Telegram are usually numeric (123456) or usernames without spaces
      const looksLikeID = (str) => /^-?\d+$/.test(str) || (str.length < 25 && !str.includes(' ') && !str.includes('\n'));
      
      const isArg1ID = looksLikeID(arg1);
      const isArg2ID = arg2 && looksLikeID(arg2);

      if (!isArg1ID && isArg2ID) {
        // (text, threadID) style
        threadID = arg2;
        text = arg1;
        replyTo = arg3;
      } else if (isArg1ID) {
        // (threadID, text) style
        threadID = arg1;
        text = arg2;
        replyTo = arg3;
      } else {
        console.error(`[Marie-TG] Critical: Could not resolve a valid threadID. arg1: ${arg1.substring(0, 20)}...`);
        return; 
      }
    } else {
      // payload-style (Facebook compatibility)
      const payload = arg1;
      threadID = arg2;
      replyTo = arg3;
      text = typeof payload === 'string' ? payload : payload.body || '';
      attachments = payload.attachment || [];
    }

    const peer = this.resolvePeer(threadID);

    if (attachments.length > 0) {
      return this.sendMedia(threadID, attachments[0], 'image', text);
    }

    return this.client.sendText(peer, text, {
      replyTo: replyTo ? parseInt(replyTo) : undefined
    });
  }

  async sendMedia(threadID, pathOrStream, type, text) {
    let mtcuteType = 'document';
    if (type === 'image') mtcuteType = 'photo';
    else if (type === 'video') mtcuteType = 'video';
    else if (type === 'audio') mtcuteType = 'audio';

    let file = pathOrStream;
    if (typeof pathOrStream === 'string' && (pathOrStream.startsWith('/') || pathOrStream.startsWith('./'))) {
      if (fs.existsSync(pathOrStream)) {
        file = fs.createReadStream(pathOrStream);
      }
    }

    return this.client.sendMedia(this.resolvePeer(threadID), {
      type: mtcuteType,
      file: file,
      caption: text
    });
  }

  async getUserInfo(uid) {
    const users = await this.client.getUsers(this.resolvePeer(uid));
    const u = users[0];
    if (!u) throw new Error(`User not found: ${uid}`);
    
    return {
      uid: u.id.toString(),
      role: 'user',
      name: u.displayName
    };
  }

  async getThreadInfo(threadID) {
    return this.client.getChat(this.resolvePeer(threadID));
  }

  async setTyping(threadID, isTyping) {
    if (isTyping) {
      await this.client.sendTyping(this.resolvePeer(threadID));
    }
  }

  // Facebook compatibility alias
  async sendTypingIndicator(arg1, arg2) {
    let isTyping;
    let threadID;

    if (typeof arg1 === 'boolean') {
      isTyping = arg1;
      threadID = arg2;
    } else {
      isTyping = true;
      threadID = arg1;
    }

    if (!threadID) return;

    const peer = this.resolvePeer(threadID);

    if (isTyping) {
      // Clear existing interval if any
      if (this.typingIntervals.has(threadID)) {
        clearInterval(this.typingIntervals.get(threadID));
      }

      // Initial typing
      await this.client.sendTyping(peer);

      // Set interval to refresh typing status every 4 seconds
      const interval = setInterval(async () => {
        try {
          await this.client.sendTyping(peer);
        } catch (e) {
          clearInterval(interval);
          this.typingIntervals.delete(threadID);
        }
      }, 4000);

      this.typingIntervals.set(threadID, interval);
    } else {
      // Stop typing
      const interval = this.typingIntervals.get(threadID);
      if (interval) {
        clearInterval(interval);
        this.typingIntervals.delete(threadID);
      }
    }
  }

  async unsendMessage(messageID) {
    await this.client.deleteMessages([parseInt(messageID)]);
  }

  static toMarieEvent(msg) {
    const chat = msg.chat;
    const sender = msg.sender;
    
    return {
      messageID: msg.id.toString(),
      threadID: chat.id.toString(),
      senderID: sender.id.toString(),
      body: msg.text || '',
      type: 'message',
      timestamp: msg.date.getTime(),
      isGroup: chat.type !== 'user',
      mentions: {},
      attachments: msg.media ? [msg.media] : [],
      senderName: sender.displayName,
      threadName: chat.displayName || chat.title || sender.displayName
    };
  }
}
