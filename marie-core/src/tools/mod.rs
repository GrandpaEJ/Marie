use std::collections::HashMap;
use crate::models::ToolDefinition;

pub trait NativeTool: Send + Sync {
    fn name(&self) -> String;
    fn definition(&self) -> ToolDefinition;
    fn execute(&self, args: String) -> String;
}

pub struct ToolRegistry {
    native_tools: HashMap<String, Box<dyn NativeTool>>,
}

impl ToolRegistry {
    pub fn new() -> Self {
        Self {
            native_tools: HashMap::new(),
        }
    }

    pub fn register(&mut self, tool: Box<dyn NativeTool>) {
        self.native_tools.insert(tool.name(), tool);
    }

    pub fn get_definitions(&self) -> Vec<ToolDefinition> {
        self.native_tools.values().map(|t| t.definition()).collect()
    }

    pub fn get_tool(&self, name: &str) -> Option<&Box<dyn NativeTool>> {
        self.native_tools.get(name)
    }

    pub fn is_native(&self, name: &str) -> bool {
        self.native_tools.contains_key(name)
    }
}

pub mod web_search;
pub mod web_fetch;
pub mod calculator;
pub mod shell;
