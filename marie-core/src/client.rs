use serde_json::{json, Value};
use crate::models::{Message, ToolDefinition, MarieError};

#[derive(uniffi::Object)]
pub struct LlmClient {
    api_key: String,
    base_url: String,
}

#[uniffi::export]
impl LlmClient {
    #[uniffi::constructor]
    pub fn new(api_key: String, base_url: String) -> Self {
        Self {
            api_key,
            base_url: base_url.trim_end_matches('/').to_string(),
        }
    }

    pub fn complete(&self, model: String, messages: Vec<Message>, tools: Option<Vec<ToolDefinition>>) -> Result<Message, MarieError> {
        let mut body = json!({
            "model": model,
            "messages": messages,
            "temperature": 0.7,
        });

        if let Some(t) = tools {
            if !t.is_empty() {
                let openai_tools: Vec<Value> = t.into_iter().map(|tool| {
                    json!({
                        "type": "function",
                        "function": {
                            "name": tool.name,
                            "description": tool.description,
                            "parameters": serde_json::from_str::<Value>(&tool.parameters_json).unwrap_or(json!({}))
                        }
                    })
                }).collect();
                body["tools"] = json!(openai_tools);
            }
        }

        let resp = ureq::post(&format!("{}/chat/completions", self.base_url))
            .set("Authorization", &format!("Bearer {}", self.api_key))
            .set("Content-Type", "application/json")
            .send_json(body)
            .map_err(|e| MarieError::Network(e.to_string()))?;

        if resp.status() != 200 {
            return Err(MarieError::Llm(format!("Status: {}", resp.status())));
        }

        let data: Value = resp.into_json().map_err(|e| MarieError::Internal(e.to_string()))?;
        let choice = &data["choices"][0]["message"];
        
        let content = choice["content"].as_str().map(|s| s.to_string());
        let tool_calls = if choice["tool_calls"].is_array() {
            Some(choice["tool_calls"].as_array().unwrap().iter().map(|c| {
                crate::models::ToolCall {
                    id: c["id"].as_str().unwrap_or_default().to_string(),
                    name: c["function"]["name"].as_str().unwrap_or_default().to_string(),
                    arguments: c["function"]["arguments"].as_str().unwrap_or_default().to_string(),
                }
            }).collect())
        } else {
            None
        };

        Ok(Message {
            role: "assistant".to_string(),
            content,
            tool_calls,
            tool_call_id: None,
        })
    }
}
