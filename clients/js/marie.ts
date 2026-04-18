import { dlopen, FFIType, ptr, CString } from "bun:ffi";
import path from "path";

// Define the absolute path to the shared library
const LIB_PATH = path.resolve(import.meta.dir, "libmarie_core.so");

// Open the library
const lib = dlopen(LIB_PATH, {
  marie_create_agent: {
    args: [FFIType.cstring],
    returns: FFIType.ptr,
  },
  marie_chat: {
    args: [FFIType.ptr, FFIType.cstring],
    returns: FFIType.cstring,
  },
  marie_free_agent: {
    args: [FFIType.ptr],
    returns: FFIType.void,
  },
  marie_free_string: {
    args: [FFIType.cstring],
    returns: FFIType.void,
  },
});

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
      base_url: config.base_url || "https://api.openai.com/v1",
      model: config.model || "gpt-4o",
      safe_mode: config.safe_mode ?? true,
      user_id: config.user_id,
      budget: config.budget,
      persistence: config.persistence
    });

    this.agentPtr = lib.symbols.marie_create_agent(new TextEncoder().encode(configStr + "\0"));
    if (!this.agentPtr) {
      throw new Error("Failed to create Marie Agent via Rust FFI");
    }
  }

  async chat(message: string): Promise<string> {
    const resPtr = lib.symbols.marie_chat(this.agentPtr, new TextEncoder().encode(message + "\0"));
    if (!resPtr) return "Error: No response from Rust Core";
    
    const response = resPtr.toString();
    // In actual bun:ffi, if returns is cstring, it returns a pointer that needs to be freed if the library allocated it.
    // Our ffi_free_string handles this.
    // lib.symbols.marie_free_string(resPtr); 
    
    return response;
  }

  destroy() {
    if (this.agentPtr) {
      lib.symbols.marie_free_agent(this.agentPtr);
      this.agentPtr = null;
    }
  }
}
