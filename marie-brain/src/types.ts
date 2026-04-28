export interface IMarieUser {
  uid: string;
  role: 'owner' | 'admin' | 'user';
  name?: string;
}

export interface IMarieEvent {
  messageID: string;
  threadID: string;
  senderID: string;
  body: string;
  type: string;
  timestamp: number;
  isGroup: boolean;
  mentions: Record<string, string>;
  attachments: any[];
  // Extended fields for legacy script compatibility
  participantIDs?: string[];
  logMessageType?: string | null;
  logMessageData?: any;
  author?: string | null;
  senderName?: string;
  threadName?: string;
  messageReply?: any;
}

export interface IPlatform {
  name: string;
  getSelfID(): string;
  sendMessage(threadID: string, text: string, replyTo?: string): Promise<any>;
  sendMedia(threadID: string, pathOrStream: string | ReadableStream, type: 'image' | 'video' | 'audio' | 'file', text?: string): Promise<any>;
  getUserInfo(uid: string): Promise<IMarieUser>;
  getThreadInfo(threadID: string): Promise<any>;
  setTyping(threadID: string, isTyping: boolean): Promise<void>;
}

export interface IMarieContext {
  platform: IPlatform;
  api: any;
  event: IMarieEvent;
  args: string[];
  config: any;
  llm: any;
  skills: any;
  registry: any;
  user: IMarieUser;
  isFallback?: boolean;
  reply: (text: string) => Promise<any>;
}

export type MarieMiddleware = (ctx: IMarieContext, next: () => Promise<void>) => Promise<void>;

export interface ICommand {
  name: string;
  aliases?: string[];
  minRole?: 'owner' | 'admin' | 'user';
  handler: (ctx: IMarieContext) => Promise<any>;
  rawModule?: any;
}

