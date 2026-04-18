use crate::tools::NativeTool;
use crate::models::ToolDefinition;
use serde_json::Value;

pub struct WebFetch;

impl NativeTool for WebFetch {
    fn name(&self) -> String {
        "web_fetch".to_string()
    }

    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            name: self.name(),
            description: "Fetch the text content of a URL (HTML, JSON, plain text). Efficient native implementation.".to_string(),
            parameters_json: r#"{
                "type": "object",
                "properties": {
                    "url": { "type": "string", "description": "Full URL to fetch" }
                },
                "required": ["url"]
            }"#.to_string(),
            safe: true,
        }
    }

    fn execute(&self, args: String) -> String {
        let json: Value = match serde_json::from_str(&args) {
            Ok(v) => v,
            Err(_) => return "Error: Invalid JSON arguments.".to_string(),
        };

        let url = match json["url"].as_str() {
            Some(u) => u,
            None => return "Error: Missing 'url' parameter.".to_string(),
        };

        match ureq::get(url)
            .set("User-Agent", "marie-core-rust/1.0")
            .call() {
            Ok(resp) => {
                match resp.into_string() {
                    Ok(text) => {
                        // Truncate to avoid context overflow, but enough for meaningful data
                        text.chars().take(15000).collect()
                    },
                    Err(e) => format!("Error reading response string: {}", e),
                }
            }
            Err(e) => format!("Network error fetching URL: {}", e),
        }
    }
}
