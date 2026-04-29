import { createTGPlatform } from '../telegram/src/index.js';
import dotenv from 'dotenv';

dotenv.config();

async function test() {
  const apiId = process.env.TELEGRAM_API_ID;
  const apiHash = process.env.TELEGRAM_API_HASH;

  if (!apiId || !apiHash) {
    console.log('Please set TELEGRAM_API_ID and TELEGRAM_API_HASH in .env');
    return;
  }

  console.log('Initializing Telegram platform...');
  const platform = await createTGPlatform({
    apiId: parseInt(apiId),
    apiHash: apiHash,
    storage: './scratch/tg-session'
  });

  console.log('Platform initialized. Client is ready but not started.');
  console.log('To fully test, you would need to run client.start() which requires user interaction for OTP.');
}

test().catch(console.error);
