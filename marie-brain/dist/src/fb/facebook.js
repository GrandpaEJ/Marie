export class FBPlatform {
    api;
    name = 'facebook';
    constructor(api) {
        this.api = api;
    }
    getSelfID() {
        return this.api.getCurrentUserID();
    }
    async sendMessage(threadID, text, replyTo) {
        return new Promise((resolve, reject) => {
            this.api.sendMessage(text, threadID, (err, msg) => {
                if (err)
                    reject(err);
                else
                    resolve(msg);
            }, replyTo);
        });
    }
    async sendMedia(threadID, pathOrStream, type, text) {
        // Basic implementation for FCA
        return new Promise((resolve, reject) => {
            const msg = { body: text || '' };
            msg.attachment = [pathOrStream];
            this.api.sendMessage(msg, threadID, (err, res) => {
                if (err)
                    reject(err);
                else
                    resolve(res);
            });
        });
    }
    async getUserInfo(uid) {
        return new Promise((resolve, reject) => {
            this.api.getUserInfo(uid, (err, info) => {
                if (err)
                    reject(err);
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
    async getThreadInfo(threadID) {
        return new Promise((resolve, reject) => {
            this.api.getThreadInfo(threadID, (err, info) => {
                if (err)
                    reject(err);
                else
                    resolve(info);
            });
        });
    }
    async setTyping(threadID, isTyping) {
        this.api.sendTypingIndicator(threadID, (err) => {
            if (err)
                console.error("Typing indicator error:", err);
        });
    }
    unsendMessage(messageID) {
        return new Promise((resolve, reject) => {
            this.api.unsendMessage(messageID, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
}
