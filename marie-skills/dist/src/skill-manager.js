import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
/**
 * Enhanced Skill Manager with MCP-aligned architecture.
 */
export class SkillManager {
    tools = new Map();
    constructor() { }
    /**
     * Registers a single tool.
     */
    register(tool) {
        this.tools.set(tool.name.toLowerCase(), tool);
        console.log(`[SkillManager] Registered tool: ${tool.name}`);
    }
    /**
     * Automatically loads all tools from a directory.
     */
    async loadTools(directoryPath) {
        try {
            const files = await fs.readdir(directoryPath);
            for (const file of files) {
                if (file.endsWith('.js') && !file.endsWith('.d.ts')) {
                    console.log(`[SkillManager] Importing tool: ${file}`);
                    const toolModule = await import(pathToFileURL(path.join(directoryPath, file)).href);
                    const tool = toolModule.default || toolModule;
                    if (tool && tool.name && tool.handler) {
                        this.register(tool);
                    }
                }
            }
        }
        catch (error) {
            console.error(`[SkillManager] Failed to load tools from ${directoryPath}:`, error.message);
        }
    }
    /**
     * MCP-aligned Tool Listing.
     */
    async listTools() {
        return Array.from(this.tools.values()).map(t => ({
            name: t.name,
            description: t.description,
            inputSchema: t.parameters || {
                type: 'object',
                properties: {},
                required: []
            }
        }));
    }
    /**
     * MCP-aligned Tool Calling.
     */
    async callTool(name, args = {}, context = {}) {
        const tool = this.tools.get(name.toLowerCase());
        if (!tool) {
            throw new Error(`Tool not found: ${name}`);
        }
        // Validate with Zod if schema exists
        let validatedArgs = args;
        if (tool.schema) {
            validatedArgs = tool.schema.parse(args);
        }
        return await tool.handler(validatedArgs, context);
    }
    /**
     * Legacy execution support.
     */
    async execute(name, params = {}, context = {}) {
        return this.callTool(name, params, context);
    }
    /**
     * OpenAI Tool Format Exporter.
     */
    getOpenAITools() {
        return Array.from(this.tools.values()).map(t => ({
            type: 'function',
            function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters
            }
        }));
    }
}
//# sourceMappingURL=skill-manager.js.map