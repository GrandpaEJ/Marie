import { ensureBinaries } from "../marie-brain/dist/index.js";
import fs from 'fs';
import path from 'path';

async function test() {
    console.log("🔍 Testing Binary Downloader...");
    
    // Check architecture to know what to expect
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
    console.log(`💻 Detected architecture: ${arch}`);

    try {
        await ensureBinaries();
        
        const binRoot = path.resolve(process.cwd(), 'bin', arch);
        const guardianExists = fs.existsSync(path.join(binRoot, 'guardian'));
        const llmExists = fs.existsSync(path.join(binRoot, 'llm'));

        if (guardianExists && llmExists) {
            console.log("✅ Binaries verified in bin/ folder.");
        } else {
            console.error("❌ Binaries missing after download attempt.");
        }
        
        console.log("✨ Downloader test completed.");
    } catch (err) {
        console.error("❌ Downloader test failed with error:", err.message);
    }
}

test();
