import { z } from 'zod';
export interface ToolDefinition {
    name: string;
    description: string;
    schema?: z.ZodObject<any>;
    parameters: any;
    handler: (params: any, context?: any) => Promise<any>;
}
/**
 * Enhanced Skill Manager with MCP-aligned architecture.
 */
export declare class SkillManager {
    private tools;
    constructor();
    /**
     * Registers a single tool.
     */
    register(tool: ToolDefinition): void;
    /**
     * Automatically loads all tools from a directory.
     */
    loadTools(directoryPath: string): Promise<void>;
    /**
     * MCP-aligned Tool Listing.
     */
    listTools(): Promise<{
        name: string;
        description: string;
        inputSchema: any;
    }[]>;
    /**
     * MCP-aligned Tool Calling.
     */
    callTool(name: string, args?: any, context?: any): Promise<any>;
    /**
     * Legacy execution support.
     */
    execute(name: string, params?: any, context?: any): Promise<any>;
    /**
     * OpenAI Tool Format Exporter.
     */
    getOpenAITools(): {
        type: string;
        function: {
            name: string;
            description: string;
            parameters: any;
        };
    }[];
}
