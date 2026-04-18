use serde::{Deserialize, Serialize};

#[derive(uniffi::Enum, Clone, Copy, Debug, Serialize, Deserialize, Eq, Hash, PartialEq)]
pub enum ModelTier {
    Nano, Fast, Frontier,
}

#[derive(uniffi::Record, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub call_type: String,
    pub function: ToolFunction,
}

#[derive(uniffi::Record, Clone, Serialize, Deserialize)]
pub struct ToolFunction {
    pub name: String,
    pub arguments: String,
}

#[derive(uniffi::Record, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(skip_serializing_if = "Option::is_none")]
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

#[derive(uniffi::Enum, Clone, Debug, Serialize, Deserialize)]
pub enum PersistenceConfig {
    None,
    Sqlite { path: String },
    Json { path: String },
    Host,
}

#[derive(uniffi::Record, Clone, Serialize, Deserialize)]
pub struct LtmNode {
    pub id: String,
    pub user_id: Option<String>,
    pub content: String,
    pub category: String,
    pub importance: f64,
    pub created_at: i64,
    pub last_accessed_at: i64,
    pub access_count: u32,
    pub tags: Vec<String>,
    pub source: String,
}

#[derive(uniffi::Error, Debug, thiserror::Error)]
pub enum MarieError {
    #[error("Network error: {0}")]
    Network(String),
    #[error("LLM error: {0}")]
    Llm(String),
    #[error("Persistence error: {0}")]
    Persistence(String),
    #[error("Internal error: {0}")]
    Internal(String),
}
