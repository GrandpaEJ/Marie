import { IPlatform, IMarieUser } from '../types.js';

export class FBPlatform implements IPlatform {
  name = 'facebook';

  constructor(public api: any) {}

  getSelfID(): string {
    return this.api.getCurrentUserID();
  }

  async sendMessage(threadID: string, text: string, replyTo?: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.api.sendMessage(text, threadID, (err: any, msg: any) => {
        if (err) reject(err);
        else resolve(msg);
      }, replyTo);
    });
  }

  async sendMedia(threadID: string, pathOrStream: any, type: 'image' | 'video' | 'audio' | 'file', text?: string): Promise<any> {
    // Basic implementation for FCA
    return new Promise((resolve, reject) => {
      const msg: any = { body: text || '' };
      msg.attachment = [pathOrStream];
      
      this.api.sendMessage(msg, threadID, (err: any, res: any) => {
        if (err) reject(err);
        else resolve(res);
      });
    });
  }

  async getUserInfo(uid: string): Promise<IMarieUser> {
    return new Promise((resolve, reject) => {
      this.api.getUserInfo(uid, (err: any, info: any) => {
        if (err) reject(err);
        else {
          const data = info[uid];
          resolve({
            uid,
            role: 'user', // Default, logic to be handled by userStore
            name: data?.name
          });
        }
      });
    });
  }

  async getThreadInfo(threadID: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.api.getThreadInfo(threadID, (err: any, info: any) => {
        if (err) reject(err);
        else resolve(info);
      });
    });
  }

  async setTyping(threadID: string, isTyping: boolean): Promise<void> {
    this.api.sendTypingIndicator(threadID, (err: any) => {
      if (err) console.error("Typing indicator error:", err);
    });
  }

  unsendMessage(messageID: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.api.unsendMessage(messageID, (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
