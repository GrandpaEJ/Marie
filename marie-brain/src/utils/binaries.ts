import fs from 'fs';
import path from 'path';
import os from 'os';
import { pipeline } from 'stream/promises';
import { execSync } from 'child_process';
import logger from './logger.js';

const REPO = 'GrandpaEJ/Marie';
const BINARIES = ['guardian', 'llm'];

export async function ensureBinaries(): Promise<void> {
    const arch = os.arch(); // 'x64' or 'arm64'
    const platform = os.platform();

    if (platform !== 'linux') {
        logger.warn(`Native binaries are only supported on Linux. Current platform: ${platform}`);
        return;
    }

    const archDir = arch === 'arm64' ? 'arm64' : 'x64';
    const baseDir = process.cwd().endsWith('app') ? '..' : '.';
    const binRoot = path.resolve(baseDir, 'bin', archDir);

    if (!fs.existsSync(binRoot)) {
        fs.mkdirSync(binRoot, { recursive: true });
    }

    for (const binName of BINARIES) {
        const binPath = path.join(binRoot, binName);
        if (!fs.existsSync(binPath)) {
            logger.info(`📥 Binary missing: ${binName} (${archDir}). Downloading...`);
            await downloadBinary(`${binName}-${archDir}`, binPath);
            fs.chmodSync(binPath, 0o755);
            logger.info(`✅ ${binName} downloaded successfully.`);
        }
    }

    // Also ensure root launchers (shell scripts) exist
    const binBase = path.resolve(baseDir, 'bin');
    for (const launcher of BINARIES) {
        const launcherPath = path.join(binBase, launcher);
        if (!fs.existsSync(launcherPath)) {
            logger.info(`📥 Launcher missing: ${launcher}. Downloading...`);
            await downloadBinary(launcher, launcherPath);
            fs.chmodSync(launcherPath, 0o755);
            logger.info(`✅ Launcher ${launcher} downloaded successfully.`);
        }
    }
}

async function downloadBinary(assetName: string, target: string): Promise<void> {
    const url = `https://github.com/${REPO}/releases/latest/download/${assetName}`;
    
    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to download ${name}: HTTP ${response.status}`);
        }

        if (!response.body) {
            throw new Error(`Failed to download ${name}: Empty body`);
        }

        const fileStream = fs.createWriteStream(target);
        await pipeline(response.body, fileStream);
    } catch (error: any) {
        throw new Error(`Download error for ${name}: ${error.message}`);
    }
}
