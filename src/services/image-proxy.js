import { fetch } from 'undici';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP_DIR = path.join(__dirname, '../../data/temp');

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

export async function getReadableStream(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
  
  // undici response.body is a ReadableStream (Web API)
  // We need a Node.js Readable stream for the FCA
  return Readable.fromWeb(response.body);
}

/**
 * Downloads an image to a temporary file and returns the path.
 * Remember to delete the file after use!
 */
export async function downloadTemp(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
  
  const ext = url.split('.').pop().split(/[?#]/)[0] || 'jpg';
  const filename = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const filePath = path.join(TEMP_DIR, filename);
  
  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
  
  return filePath;
}

export function cleanupTemp(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (e) {
    console.error('Cleanup failed:', e.message);
  }
}
