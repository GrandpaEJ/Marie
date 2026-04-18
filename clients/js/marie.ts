import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

// Universal directory resolution for Bun and Node.js ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIB_PATH = path.resolve(__dirname, "libmarie_core.so");

interface MarieFfiSymbols {
    marie_create_agent: (config: string, callback: any) => any;
    marie_chat: (agentPtr: any, message: string) => any;
    marie_register_host_tool: (agentPtr: any, toolJson: string) => boolean;
    marie_free_agent: (agentPtr: any) => void;
    marie_free_string: (strPtr: any) => void;
}

const isBun = typeof process !== "undefined" && process.versions && process.versions.bun;

let lib: MarieFfiSymbols;
let globalCallback: any = null;

export interface MarieTool {
    name: string;
    description: string;
    parameters: any;
    safe?: boolean;
    run: (args: any) => string | Promise<string>;
}

// Registry for tools across all agents (simplified for FFI callback)
const toolsRegistry = new Map<string, MarieTool>();

if (isBun) {
    const { dlopen, FFIType, JSCallback } = require("bun:ffi");
    
    // Define the callback that Rust will call
    globalCallback = new JSCallback(
        (namePtr: number, argsPtr: number) => {
            const { CString } = require("bun:ffi");
            const name = new CString(namePtr).toString();
            const args = new CString(argsPtr).toString();
            
            const tool = toolsRegistry.get(name);
            if (!tool) return Buffer.from("Error: Tool not found\0");
            
            try {
                const parsedArgs = JSON.parse(args);
                // Synchronous bridge for now (FFI callbacks are typically sync)
                const result = tool.run(parsedArgs);
                if (result instanceof Promise) {
                    return Buffer.from("Error: Async tools not supported in sync FFI yet\0");
                }
                return Buffer.from(result + "\0");
            } catch (e) {
                return Buffer.from(`Error: ${e}\0`);
            }
        },
        {
            args: [FFIType.ptr, FFIType.ptr],
            returns: FFIType.ptr,
        }
    );

    const bunLib = dlopen(LIB_PATH, {
        marie_create_agent: {
            args: [FFIType.cstring, FFIType.ptr],
            returns: FFIType.ptr,
        },
        marie_chat: {
            args: [FFIType.ptr, FFIType.cstring],
            returns: FFIType.ptr,
        },
        marie_register_host_tool: {
            args: [FFIType.ptr, FFIType.cstring],
            returns: FFIType.bool,
        },
        marie_free_agent: {
            args: [FFIType.ptr],
            returns: FFIType.void,
        },
        marie_free_string: {
            args: [FFIType.ptr],
            returns: FFIType.void,
        },
    });

    lib = {
        marie_create_agent: (config: string, cb: any) => {
            const configBuf = Buffer.from(config + "\0");
            const callbackPtr = cb?.ptr ?? cb ?? 0;
            return bunLib.symbols.marie_create_agent(configBuf, callbackPtr);
        },
        marie_chat: (agentPtr: any, message: string) => bunLib.symbols.marie_chat(agentPtr, Buffer.from(message + "\0")),
        marie_register_host_tool: (agentPtr: any, toolJson: string) => bunLib.symbols.marie_register_host_tool(agentPtr, Buffer.from(toolJson + "\0")),
        marie_free_agent: (agentPtr: any) => bunLib.symbols.marie_free_agent(agentPtr),
        marie_free_string: (strPtr: any) => bunLib.symbols.marie_free_string(strPtr),
    };
} else {
    // Node.js implementation using koffi
    const koffi = require("koffi");
    const nodeLib = koffi.load(LIB_PATH);

    const AgentPtr = koffi.pointer("AgentPtr", koffi.opaque());
    
    // Define callback type in Koffi
    const ToolCallback = koffi.proto("char* ToolCallback(const char* name, const char* args)");
    
    globalCallback = (name: string, args: string) => {
        const tool = toolsRegistry.get(name);
        if (!tool) return "Error: Tool not found";
        try {
            const parsedArgs = JSON.parse(args);
            const result = tool.run(parsedArgs);
            if (result instanceof Promise) return "Error: Async tools not supported in sync FFI yet";
            return result;
        } catch (e) {
            return `Error: ${e}`;
        }
    };

    const marie_create_agent = nodeLib.func("marie_create_agent", AgentPtr, ["str", koffi.pointer(ToolCallback)]);
    const marie_register_host_tool = nodeLib.func("marie_register_host_tool", "bool", [AgentPtr, "str"]);
    const marie_free_agent = nodeLib.func("marie_free_agent", "void", [AgentPtr]);

    lib = {
        marie_create_agent: (config: string, cb: any) => marie_create_agent(config, cb),
        marie_chat: (agentPtr: any, message: string) => {
            const result = nodeLib.func("marie_chat", koffi.pointer("char"), [AgentPtr, "str"])(agentPtr, message);
            return result;
        },
        marie_register_host_tool: (agentPtr: any, json: string) => marie_register_host_tool(agentPtr, json),
        marie_free_agent: (agentPtr: any) => marie_free_agent(agentPtr),
        marie_free_string: (strPtr: any) => nodeLib.func("marie_free_string", "void", [koffi.pointer("char")])(strPtr),
    };
}

export interface MarieConfig {
    api_key?: string;
    base_url?: string;
    model?: string;
    safe_mode?: boolean;
    user_id?: string;
    budget?: {
        max_tokens?: number;
        max_cost_usd?: number;
        max_steps?: number;
    };
    persistence?: {
        mode: "none" | "sqlite" | "json" | "host";
        path: string;
    };
}

export class MarieAgent {
    private agentPtr: any;

    constructor(config: MarieConfig = {}) {
        const configStr = JSON.stringify({
            api_key: config.api_key || process.env.AI_API_KEY || "sk-dummy",
            base_url: config.base_url || "https://zero-bot.net/api/ai/v1",
            model: config.model || "openai/gpt-oss-120b",
            safe_mode: config.safe_mode ?? true,
            user_id: config.user_id,
            budget: config.budget,
            persistence: config.persistence
        });

        // Pass the static global callback to Rust
        this.agentPtr = lib.marie_create_agent(configStr, globalCallback);
        if (!this.agentPtr) {
            throw new Error("Failed to create Marie Agent via Rust FFI");
        }
    }

    addTool(tool: MarieTool) {
        toolsRegistry.set(tool.name, tool);
        const definition = {
            name: tool.name,
            description: tool.description,
            parameters_json: JSON.stringify(tool.parameters),
            safe: tool.safe ?? true
        };
        lib.marie_register_host_tool(this.agentPtr, JSON.stringify(definition));
    }

    async chat(message: string): Promise<string> {
        const resPtr = lib.marie_chat(this.agentPtr, message);
        if (!resPtr) return "Error: No response from Rust Core";

        try {
            if (isBun) {
                const { CString } = require("bun:ffi");
                return new CString(resPtr).toString();
            } else {
                const koffi = require("koffi");
                return koffi.decode(resPtr, "str");
            }
        } finally {
            lib.marie_free_string(resPtr);
        }
    }

    destroy() {
        if (this.agentPtr) {
            lib.marie_free_agent(this.agentPtr);
            this.agentPtr = null;
        }
    }
}
