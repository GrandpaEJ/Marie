#[derive(uniffi::Record, Clone)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: String,
}

#[derive(uniffi::Record, Clone)]
pub struct Message {
    pub role: String,
    pub content: Option<String>,
    pub tool_calls: Option<Vec<ToolCall>>,
    pub tool_call_id: Option<String>,
}

#[derive(uniffi::Record, Clone, Copy)]
pub struct Budget {
    pub max_tokens: Option<u32>,
    pub max_cost_usd: Option<f64>,
    pub max_steps: Option<u32>,
}

#[derive(uniffi::Record, Clone)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub parameters_json: String,
    pub safe: bool,
}

#[derive(uniffi::Record)]
pub struct Metrics {
    pub tokens: u32,
    pub cost_usd: f64,
    pub steps: u32,
}
