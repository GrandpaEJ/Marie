import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';

export interface ToolDefinition {
  name: string;
  description: string;
  category?: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  detailedDescription?: string;
  examples?: Array<{ input: any; explanation?: string }>;
  schema?: z.ZodObject<any>;
  parameters: any;
  handler: (params: any, context?: any) => Promise<any>;
}

/**
 * Enhanced Skill Manager with MCP-aligned architecture.
 */
export class SkillManager {
  private tools: Map<string, ToolDefinition> = new Map();

  constructor() {}

  /**
   * Registers a single tool.
   */
  register(tool: ToolDefinition) {
    this.tools.set(tool.name.toLowerCase(), tool);
    console.log(`[SkillManager] Registered tool: ${tool.name}`);
  }

  /**
   * Automatically loads all tools from a directory.
   */
  async loadTools(directoryPath: string) {
    try {
      const files = await fs.readdir(directoryPath);
      for (const file of files) {
        if ((file.endsWith('.js') || file.endsWith('.ts')) && !file.endsWith('.d.ts')) {
          console.log(`[SkillManager] Importing tool: ${file}`);
          const toolModule = await import(pathToFileURL(path.join(directoryPath, file)).href);
          const tool = toolModule.default || toolModule;
          if (tool && tool.name && tool.handler) {
            this.register(tool);
          }
        }
      }
    } catch (error: any) {
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
  async callTool(name: string, args: any = {}, context: any = {}) {
    const tool = this.tools.get(name.toLowerCase());
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    // 0. Risk-Based Access Control (RBAC)
    let risk = tool.riskLevel || 'low';
    const userRole = context.user?.role || 'user';
    
    // Allow overrides from config
    if (context.config?.toolRiskOverrides?.[name]) {
      risk = context.config.toolRiskOverrides[name];
    }

    if (risk === 'critical' || risk === 'high') {
      if (userRole !== 'owner') {
        throw new Error(`Permission Denied: Tool "${name}" is classified as ${risk} risk and requires OWNER role.`);
      }
    } else if (risk === 'medium') {
      if (userRole !== 'owner' && userRole !== 'admin') {
        throw new Error(`Permission Denied: Tool "${name}" is classified as medium risk and requires ADMIN role.`);
      }
    }

    // Validate with Zod if schema exists
    let validatedArgs = args;
    if (tool.schema) {
      validatedArgs = tool.schema.parse(args);
    }

    return await tool.handler(validatedArgs, context);
  }

  /**
   * Unregisters a tool.
   */
  unregister(name: string) {
    this.tools.delete(name.toLowerCase());
  }

  /**
   * Hot-reloads a tool by re-importing the file.
   */
  async hotReload(name: string, filePath: string) {
    this.unregister(name);
    const toolModule = await import(pathToFileURL(filePath).href + '?update=' + Date.now());
    const tool = toolModule.default || toolModule;
    if (tool && tool.name && tool.handler) {
      this.register(tool);
    }
  }

  /**
   * Legacy execution support.
   */
  async execute(name: string, params: any = {}, context: any = {}) {
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
