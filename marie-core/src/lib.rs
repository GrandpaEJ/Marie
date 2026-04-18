use serde::{Deserialize, Serialize};
use std::sync::{Mutex, Arc};
use std::collections::HashMap;
use reqwest::{Client, header};
use serde_json::{json, Value};
use regex::Regex;
use once_cell::sync::Lazy;

uniffi::setup_scaffolding!();

// --- ERRORS ---

#[derive(uniffi::Error, Debug, thiserror::Error)]
pub enum MarieError {
    #[error("Network error: {0}")]
    Network(String),
    #[error("LLM error: {0}")]
    Llm(String),
    #[error("Internal error: {0}")]
    Internal(String),
}

// --- INTERFACES ---

#[uniffi::export(callback_interface)]
pub trait ToolExecutor: Send + Sync {
    fn execute(&self, name: String, args: String) -> String;
}

#[uniffi::export(callback_interface)]
pub trait Summarizer: Send + Sync {
    fn summarize(&self, messages: Vec<Message>) -> String;
}

// --- MODELS ---

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

// --- BRAIN ---

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
        if self.safe_mode { list.retain(|t| t.safe); }
        list
    }
    pub fn is_tool_allowed(&self, name: String) -> bool {
        let tools = self.tools.lock().unwrap();
        if let Some(tool) = tools.get(&name) {
            return !(self.safe_mode && !tool.safe);
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
        if let Some(max) = self.budget.max_tokens { if *total_tokens > max { return false; } }
        if let Some(max) = self.budget.max_cost_usd { if *total_cost > max { return false; } }
        if let Some(max) = self.budget.max_steps { if *steps > max { return false; } }
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

// --- CLIENT ---

#[derive(uniffi::Object)]
pub struct LLMClient {
    api_key: String,
    base_url: String,
    http: Client,
}

#[uniffi::export]
impl LLMClient {
    #[uniffi::constructor]
    pub fn new(api_key: String, base_url: String) -> Self {
        Self {
            api_key,
            base_url: base_url.trim_end_matches('/').to_string(),
            http: Client::new(),
        }
    }
    pub async fn complete(&self, model: String, messages: Vec<Message>, tools: Option<Vec<ToolDefinition>>) -> Result<Message, MarieError> {
        let mut headers = header::HeaderMap::new();
        headers.insert(header::AUTHORIZATION, header::HeaderValue::from_str(&format!("Bearer {}", self.api_key)).unwrap());
        headers.insert(header::CONTENT_TYPE, header::HeaderValue::from_static("application/json"));
        let mut body = json!({"model": model, "messages": messages, "temperature": 0.7});
        if let Some(t) = tools {
            if !t.is_empty() {
                let openai_tools: Vec<Value> = t.into_iter().map(|tool| {
                    json!({"type": "function", "function": {"name": tool.name, "description": tool.description, "parameters": serde_json::from_str::<Value>(&tool.parameters_json).unwrap_or(json!({}))}})
                }).collect();
                body["tools"] = json!(openai_tools);
            }
        }
        let res = self.http.post(format!("{}/chat/completions", self.base_url)).headers(headers).json(&body).send().await.map_err(|e| MarieError::Network(e.to_string()))?;
        if !res.status().is_success() { return Err(MarieError::Llm(format!("Status: {}", res.status()))); }
        let data: Value = res.json().await.map_err(|e| MarieError::Internal(e.to_string()))?;
        let choice = &data["choices"][0]["message"];
        let content = choice["content"].as_str().map(|s| s.to_string());
        let tool_calls = if choice["tool_calls"].is_array() {
            Some(choice["tool_calls"].as_array().unwrap().iter().map(|c| {
                ToolCall { id: c["id"].as_str().unwrap_or_default().to_string(), name: c["function"]["name"].as_str().unwrap_or_default().to_string(), arguments: c["function"]["arguments"].as_str().unwrap_or_default().to_string() }
            }).collect())
        } else { None };
        Ok(Message { role: "assistant".to_string(), content, tool_calls, tool_call_id: None })
    }
}

// --- ROUTING ---

static NANO_PATTERNS: Lazy<Vec<Regex>> = Lazy::new(|| {
    vec![Regex::new(r"(?i)^(what is|what's|who is|who's|when did|when is|how many|how much)\b").unwrap(), Regex::new(r"(?i)\b(translate|convert|format|summarize in one sentence)\b").unwrap(), Regex::new(r"^[\d\s+\-*/()^.]+$").unwrap()]
});
static FRONTIER_PATTERNS: Lazy<Vec<Regex>> = Lazy::new(|| {
    vec![Regex::new(r"(?i)\b(architect|design|implement|refactor|debug|analyze|reason|strategize)\b").unwrap(), Regex::new(r"(?i)\b(write (a |the )?(full|complete|production|complex))\b").unwrap(), Regex::new(r"(?i)\b(compare and contrast|pros and cons|tradeoffs)\b").unwrap(), Regex::new(r"(?i)\b(step[- ]by[- ]step|detailed plan|comprehensive)\b").unwrap()]
});

pub fn classify_tier(message: &str, has_tools: bool) -> ModelTier {
    if !has_tools {
        let words = message.split_whitespace().count();
        if words <= 20 && NANO_PATTERNS.iter().any(|re| re.is_match(message)) { return ModelTier::Nano; }
    }
    let words = message.split_whitespace().count();
    if words > 80 || FRONTIER_PATTERNS.iter().any(|re| re.is_match(message)) { return ModelTier::Frontier; }
    ModelTier::Fast
}

#[derive(uniffi::Object)]
pub struct ModelRouter { tier_map: HashMap<ModelTier, String>, default_tier: ModelTier }
#[uniffi::export]
impl ModelRouter {
    #[uniffi::constructor]
    pub fn new(nano: Option<String>, fast: Option<String>, frontier: Option<String>, default_tier: Option<ModelTier>) -> Self {
        let mut tier_map = HashMap::new();
        if let Some(m) = nano { tier_map.insert(ModelTier::Nano, m); }
        if let Some(m) = fast { tier_map.insert(ModelTier::Fast, m); }
        if let Some(m) = frontier { tier_map.insert(ModelTier::Frontier, m); }
        Self { tier_map, default_tier: default_tier.unwrap_or(ModelTier::Fast) }
    }
    pub fn route(&self, message: String, has_tools: bool, fallback: String) -> String {
        let tier = classify_tier(&message, has_tools);
        self.tier_map.get(&tier).or_else(|| self.tier_map.get(&self.default_tier)).cloned().unwrap_or(fallback)
    }
}

// --- MEMORY ---

#[derive(uniffi::Object)]
pub struct SlidingWindowMemory {
    full_history: Mutex<Vec<Message>>,
    summary: Mutex<Option<String>>,
    recent_turns: u32,
    summarizer: Option<Box<dyn Summarizer>>,
}

#[uniffi::export]
impl SlidingWindowMemory {
    #[uniffi::constructor]
    pub fn new(recent_turns: Option<u32>, summarizer: Option<Box<dyn Summarizer>>) -> Self {
        Self { full_history: Mutex::new(Vec::new()), summary: Mutex::new(None), recent_turns: recent_turns.unwrap_or(10), summarizer }
    }
    pub fn add(&self, message: Message) { self.full_history.lock().unwrap().push(message); }
    pub fn get_history(&self) -> Vec<Message> {
        let max_messages = (self.recent_turns * 2) as usize;
        let mut history = self.full_history.lock().unwrap();
        let mut summary = self.summary.lock().unwrap();
        if history.len() <= max_messages { return history.clone(); }
        let split_idx = history.len() - max_messages;
        let old_messages: Vec<Message> = history.iter().take(split_idx).cloned().collect();
        let recent_messages: Vec<Message> = history.iter().skip(split_idx).cloned().collect();
        if let Some(ref s) = self.summarizer {
            let new_summary = s.summarize(old_messages);
            *summary = Some(new_summary);
            *history = recent_messages.clone();
        }
        let mut result = Vec::new();
        if let Some(ref sum_text) = *summary {
            result.push(Message { role: "user".to_string(), content: Some(format!("[Earlier conversation summary]: {}", sum_text)), tool_calls: None, tool_call_id: None });
            result.push(Message { role: "assistant".to_string(), content: Some("Understood.".to_string()), tool_calls: None, tool_call_id: None });
        }
        result.extend(recent_messages);
        result
    }
}

// --- AGENT LOOP ---

#[derive(uniffi::Object)]
pub struct MarieAgent {
    client: Arc<LLMClient>,
    brain: Arc<MarieBrain>,
    memory: Arc<SlidingWindowMemory>,
    router: Option<Arc<ModelRouter>>,
    executor: Box<dyn ToolExecutor>,
    default_model: String,
}

#[uniffi::export]
impl MarieAgent {
    #[uniffi::constructor]
    pub fn new(
        client: Arc<LLMClient>, brain: Arc<MarieBrain>, memory: Arc<SlidingWindowMemory>,
        router: Option<Arc<ModelRouter>>, executor: Box<dyn ToolExecutor>, default_model: String,
    ) -> Self {
        Self { client, brain, memory, router, executor, default_model }
    }
    pub async fn chat(&self, user_message: String) -> Result<String, MarieError> {
        self.memory.add(Message { role: "user".to_string(), content: Some(user_message.clone()), tool_calls: None, tool_call_id: None });
        let mut current_step = 0;
        loop {
            if current_step >= 10 { return Err(MarieError::Internal("Max steps reached.".to_string())); }
            let has_tools = !self.brain.get_tool_definitions().is_empty();
            let model = if let Some(ref r) = self.router { r.route(user_message.clone(), has_tools, self.default_model.clone()) } else { self.default_model.clone() };
            let history = self.memory.get_history();
            let tools = self.brain.get_tool_definitions();
            let response_msg = self.client.complete(model, history, Some(tools)).await?;
            self.brain.track_usage(100, 0.001);
            if let Some(ref tool_calls) = response_msg.tool_calls {
                if !tool_calls.is_empty() {
                    self.memory.add(response_msg.clone());
                    for tc in tool_calls {
                        let result = if !self.brain.is_tool_allowed(tc.name.clone()) { format!("Blocked: {}", tc.name) }
                        else { self.executor.execute(tc.name.clone(), tc.arguments.clone()) };
                        self.memory.add(Message { role: "tool".to_string(), content: Some(result), tool_calls: None, tool_call_id: Some(tc.id.clone()) });
                    }
                    current_step += 1; continue;
                }
            }
            let content = response_msg.content.clone().unwrap_or_default();
            self.memory.add(response_msg);
            return Ok(content);
        }
    }
}
