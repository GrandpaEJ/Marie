use std::sync::Mutex;
use std::collections::HashMap;
use crate::models::{Budget, ToolDefinition, Metrics};

#[derive(uniffi::Object)]
pub struct MarieBrain {
    budget: Budget,
    total_tokens: Mutex<u32>,
    total_cost: Mutex<f64>,
    steps: Mutex<u32>,
    tools: Mutex<HashMap<String, ToolDefinition>>,
    safe_mode: bool,
}

#[uniffi::export]
impl MarieBrain {
    #[uniffi::constructor]
    pub fn new(budget: Budget, safe_mode: bool) -> Self {
        Self {
            budget,
            total_tokens: Mutex::new(0),
            total_cost: Mutex::new(0.0),
            steps: Mutex::new(0),
            tools: Mutex::new(HashMap::new()),
            safe_mode,
        }
    }

    pub fn register_tool(&self, tool: ToolDefinition) {
        let mut tools = self.tools.lock().unwrap();
        tools.insert(tool.name.clone(), tool);
    }

    pub fn get_tool_definitions(&self) -> Vec<ToolDefinition> {
        let tools = self.tools.lock().unwrap();
        let mut list: Vec<ToolDefinition> = tools.values().cloned().collect();
        if self.safe_mode {
            list.retain(|t| t.safe);
        }
        list
    }

    pub fn is_tool_allowed(&self, name: String) -> bool {
        let tools = self.tools.lock().unwrap();
        if let Some(tool) = tools.get(&name) {
            if self.safe_mode && !tool.safe {
                return false;
            }
            return true;
        }
        false
    }

    pub fn track_usage(&self, tokens: u32, cost_usd: f64) -> bool {
        let mut total_tokens = self.total_tokens.lock().unwrap();
        let mut total_cost = self.total_cost.lock().unwrap();
        let mut steps = self.steps.lock().unwrap();

        *total_tokens += tokens;
        *total_cost += cost_usd;
        *steps += 1;

        if let Some(max) = self.budget.max_tokens {
            if *total_tokens > max { return false; }
        }
        if let Some(max) = self.budget.max_cost_usd {
            if *total_cost > max { return false; }
        }
        if let Some(max) = self.budget.max_steps {
            if *steps > max { return false; }
        }
        true
    }

    pub fn get_metrics(&self) -> Metrics {
        Metrics {
            tokens: *self.total_tokens.lock().unwrap(),
            cost_usd: *self.total_cost.lock().unwrap(),
            steps: *self.steps.lock().unwrap(),
        }
    }
}
