use crate::tools::NativeTool;
use crate::models::ToolDefinition;
use serde_json::Value;

pub struct WebSearch;

impl NativeTool for WebSearch {
    fn name(&self) -> String {
        "web_search".to_string()
    }

    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            name: self.name(),
            description: "Search the web for real-time information. Useful for current events, facts, and documentation.".to_string(),
            parameters_json: r#"{
                "type": "object",
                "properties": {
                    "query": { "type": "string", "description": "The search query" }
                },
                "required": ["query"]
            }"#.to_string(),
            safe: true,
        }
    }

    fn execute(&self, args: String) -> String {
        let json: Value = match serde_json::from_str(&args) {
            Ok(v) => v,
            Err(_) => return "Error: Invalid JSON arguments.".to_string(),
        };

        let query = match json["query"].as_str() {
            Some(q) => q,
            None => return "Error: Missing 'query' parameter.".to_string(),
        };

        let url = format!("https://api.duckduckgo.com/?q={}&format=json&no_html=1", 
            urlencoding::encode(query));

        match ureq::get(&url)
            .set("User-Agent", "marie-core-rust/1.0")
            .call() {
            Ok(resp) => {
                let data: Value = match resp.into_json() {
                    Ok(v) => v,
                    Err(e) => return format!("Error parsing search results: {}", e),
                };

                let abstract_text = data["AbstractText"].as_str().unwrap_or("");
                let related_topics = data["RelatedTopics"].as_array();
                
                let mut results = String::new();
                if !abstract_text.is_empty() {
                    results.push_str(&format!("Summary: {}\n", abstract_text));
                }

                if let Some(topics) = related_topics {
                    for topic in topics.iter().take(5) {
                        if let Some(text) = topic["Text"].as_str() {
                            results.push_str(&format!("- {}\n", text));
                        }
                    }
                }

                if results.is_empty() {
                    "No direct facts found for this query. Try a broader search term or use web_fetch for a specific URL.".to_string()
                } else {
                    // Truncate to match web_fetch parity
                    results.chars().take(15000).collect()
                }
            }
            Err(e) => format!("Network error during search: {}", e),
        }
    }
}
