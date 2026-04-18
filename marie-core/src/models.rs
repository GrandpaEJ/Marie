use serde::{Deserialize, Serialize};

#[derive(uniffi::Enum, Clone, Copy, Debug, Serialize, Deserialize, Eq, Hash, PartialEq)]
pub enum ModelTier {
    Nano, Fast, Frontier,
}

#[derive(uniffi::Record, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: String,
}

#[derive(uniffi::Record, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    pub content: Option<String>,
    pub tool_calls: Option<Vec<ToolCall>>,
    pub tool_call_id: Option<String>,
}

#[derive(uniffi::Record, Clone, Copy, Serialize, Deserialize)]
pub struct Budget {
    pub max_tokens: Option<u32>,
    pub max_cost_usd: Option<f64>,
    pub max_steps: Option<u32>,
}

#[derive(uniffi::Record, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub parameters_json: String,
    pub safe: bool,
}

#[derive(uniffi::Record, Clone, Serialize, Deserialize)]
pub struct Metrics {
    pub tokens: u32,
    pub cost_usd: f64,
    pub steps: u32,
}

#[derive(uniffi::Error, Debug, thiserror::Error)]
pub enum MarieError {
    #[error("Network error: {0}")]
    Network(String),
    #[error("LLM error: {0}")]
    Llm(String),
    #[error("Internal error: {0}")]
    Internal(String),
}
