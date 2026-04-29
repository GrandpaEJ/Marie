import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, '../../config.json');

const ConfigSchema = z.object({
  botName: z.string().default('Marie'),
  prefix: z.string().default('.'),
  owner: z.string(),
  admins: z.array(z.string()).default([]),
  llm: z.object({
    provider: z.string().default('openrouter'),
    baseUrl: z.string().url(),
    defaultModel: z.string(),
    maxContextTokens: z.number().default(8192),
    maxResponseTokens: z.number().default(1024),
    temperature: z.number().default(0.85)
  }),
  rp: z.object({
    enabled: z.boolean().default(true),
    defaultPersona: z.string()
  }),
  anime: z.object({
    nsfwAllowed: z.boolean().default(false),
    providers: z.array(z.string())
  }),
  platforms: z.object({
    enabled: z.array(z.string()).default(['facebook']),
    facebook: z.object({
      appstate: z.string().default('./appstate.json'),
      owner: z.string().optional(),
      admins: z.array(z.string()).optional()
    }).optional(),
    telegram: z.object({
      token: z.string().optional(),
      apiId: z.number().optional(),
      apiHash: z.string().optional(),
      owner: z.string().optional(),
      admins: z.array(z.string()).optional()
    }).optional()
  }).optional()
});

export function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error('config.json not found');
  }

  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  const config = ConfigSchema.parse(raw);
  
  // Mix in environment variables
  config.openrouter_api_key = process.env.OPENROUTER_API_KEY;
  config.appstate_path = process.env.APPSTATE_PATH || './appstate.json';

  return config;
}
