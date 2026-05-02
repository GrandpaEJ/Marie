'use strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';
import logger from './logger.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = 'GrandpaEJ/Marie';
const BINARIES = Object.freeze(['guardian', 'llm']);
/**
 * Ensures native binaries are present for the current architecture.
 * @returns {Promise<void>}
 */
export async function ensureBinaries() {
    const arch = os.arch(); // 'x64' or 'arm64'
    const platform = os.platform();
    if (platform !== 'linux') {
        logger.warn(`Native binaries are only supported on Linux. Current platform: ${platform}`);
        return;
    }
    const archDir = arch === 'arm64' ? 'arm64' : 'x64';
    // Path resolution from marie-brain/src/utils/binaries.js to project root
    const baseDir = path.resolve(__dirname, '../../..');
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
/**
 * Downloads a binary asset from GitHub Releases.
 * @param {string} assetName
 * @param {string} target
 * @returns {Promise<void>}
 */
async function downloadBinary(assetName, target) {
    const url = `https://github.com/${REPO}/releases/latest/download/${assetName}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to download ${assetName}: HTTP ${response.status}`);
        }
        if (!response.body) {
            throw new Error(`Failed to download ${assetName}: Empty body`);
        }
        const fileStream = fs.createWriteStream(target);
        // @ts-ignore - response.body is a ReadableStream which pipeline handles in Node 18+
        await pipeline(response.body, fileStream);
    }
    catch (error) {
        throw new Error(`Download error for ${assetName}: ${error.message}`);
    }
}
