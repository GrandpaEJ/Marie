import { TelegramClient } from '@mtcute/node';
import { TGPlatform } from './platform.js';
import dotenv from 'dotenv';

dotenv.config();

export async function createTGPlatform(config) {
  const client = new TelegramClient({
    apiId: config.apiId,
    apiHash: config.apiHash,
    storage: config.storage || 'marie-tg-session'
  });

  return new TGPlatform(client);
}

export { TGPlatform };
export * from '@mtcute/node';
export * from '@mtcute/dispatcher';
