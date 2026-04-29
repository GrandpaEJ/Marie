import { IPlatform, IMarieUser } from '../types.js';
export declare class FBPlatform implements IPlatform {
    api: any;
    name: string;
    constructor(api: any);
    getSelfID(): string;
    sendMessage(threadID: string, text: string, replyTo?: string): Promise<any>;
    sendMedia(threadID: string, pathOrStream: any, type: 'image' | 'video' | 'audio' | 'file', text?: string): Promise<any>;
    getUserInfo(uid: string): Promise<IMarieUser>;
    getThreadInfo(threadID: string): Promise<any>;
    setTyping(threadID: string, isTyping: boolean): Promise<void>;
    unsendMessage(messageID: string): Promise<void>;
}
