use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::sync::Arc;
use serde_json::Value;
use crate::agent::MarieAgent;
use crate::models::{MarieError, PersistenceConfig, Budget};
use crate::client::LlmClient;
use crate::brain::MarieBrain;
use crate::memory::SlidingWindowMemory;
use crate::interfaces::ToolExecutor;

// Opaque pointer for the Agent
pub struct AgentPtr(Arc<MarieAgent>);

/// Default implementation of ToolExecutor for FFI
struct FfiToolExecutor;
impl ToolExecutor for FfiToolExecutor {
    fn execute(&self, _name: String, _args: String) -> String {
        format!("Error: Tool execution not implemented in raw FFI yet. Please use the host bridge for tool logic.")
    }
}

#[no_mangle]
pub extern "C" fn marie_create_agent(config_json: *const c_char) -> *mut AgentPtr {
    let c_str = unsafe {
        if config_json.is_null() { return std::ptr::null_mut(); }
        CStr::from_ptr(config_json)
    };
    
    let json_str = match c_str.to_str() {
        Ok(s) => s,
        Err(_) => return std::ptr::null_mut(),
    };

    let config: Value = match serde_json::from_str(json_str) {
        Ok(v) => v,
        Err(_) => return std::ptr::null_mut(),
    };

    let api_key = config["api_key"].as_str().unwrap_or("sk-dummy").to_string();
    let base_url = config["base_url"].as_str().unwrap_or("https://openrouter.ai/api/v1").to_string();
    let model = config["model"].as_str().unwrap_or("openrouter/free").to_string();
    let safe_mode = config["safe_mode"].as_bool().unwrap_or(true);
    let user_id = config["user_id"].as_str().map(|s| s.to_string());

    let client = Arc::new(LlmClient::new(api_key, base_url));
    
    let budget = Budget {
        max_tokens: config["budget"]["max_tokens"].as_u64().map(|v| v as u32),
        max_cost_usd: config["budget"]["max_cost_usd"].as_f64(),
        max_steps: Some(config["budget"]["max_steps"].as_u64().map(|v| v as u32).unwrap_or(10)),
    };
    
    let brain = Arc::new(MarieBrain::new(budget, safe_mode));
    
    // Persistence Config
    let pers_config = if let Some(p) = config["persistence"].as_object() {
        let mode = p.get("mode").and_then(|m| m.as_str()).unwrap_or("none");
        let path = p.get("path").and_then(|p| p.as_str()).unwrap_or("marie.sqlite").to_string();
        match mode {
            "sqlite" => PersistenceConfig::Sqlite { path },
            "json" => PersistenceConfig::Json { path },
            _ => PersistenceConfig::None,
        }
    } else {
        PersistenceConfig::None
    };

    let memory = Arc::new(SlidingWindowMemory::new(
        Some(10),
        None,
        pers_config,
        None,
        user_id,
    ));

    let agent = Arc::new(MarieAgent::new(
        client,
        brain,
        memory,
        None,
        Box::new(FfiToolExecutor),
        model,
    ));

    Box::into_raw(Box::new(AgentPtr(agent)))
}

#[no_mangle]
pub extern "C" fn marie_chat(agent_ptr: *mut AgentPtr, message: *const c_char) -> *mut c_char {
    let agent = unsafe {
        if agent_ptr.is_null() { return std::ptr::null_mut(); }
        &mut *agent_ptr
    };

    let c_str = unsafe {
        if message.is_null() { return std::ptr::null_mut(); }
        CStr::from_ptr(message)
    };

    let msg = match c_str.to_str() {
        Ok(s) => s,
        Err(_) => return std::ptr::null_mut(),
    };

    match agent.0.chat(msg.to_string()) {
        Ok(response) => {
            CString::new(response).unwrap().into_raw()
        }
        Err(e) => {
            let error_msg = match e {
                MarieError::Network(s) => format!("Network Error: {}", s),
                MarieError::Llm(s) => format!("LLM Error: {}", s),
                MarieError::Persistence(s) => format!("Persistence Error: {}", s),
                _ => format!("Internal Error: {:?}", e),
            };
            CString::new(error_msg).unwrap().into_raw()
        }
    }
}

#[no_mangle]
pub extern "C" fn marie_free_agent(agent_ptr: *mut AgentPtr) {
    if !agent_ptr.is_null() {
        unsafe {
            let _ = Box::from_raw(agent_ptr);
        }
    }
}

#[no_mangle]
pub extern "C" fn marie_free_string(s: *mut c_char) {
    if !s.is_null() {
        unsafe {
            let _ = CString::from_raw(s);
        }
    }
}
