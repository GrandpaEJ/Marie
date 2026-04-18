use std::sync::Arc;
use crate::models::{Message, MarieError};
use crate::brain::MarieBrain;
use crate::client::LlmClient;
use crate::memory::SlidingWindowMemory;
use crate::routing::ModelRouter;
use crate::interfaces::ToolExecutor;
use crate::tools::ToolRegistry;

#[derive(uniffi::Object)]
pub struct MarieAgent {
    client: Arc<LlmClient>,
    brain: Arc<MarieBrain>,
    memory: Arc<SlidingWindowMemory>,
    router: Option<Arc<ModelRouter>>,
    registry: Arc<ToolRegistry>,
    host_executor: Option<Box<dyn ToolExecutor>>,
    default_model: String,
}

#[uniffi::export]
impl MarieAgent {
    #[uniffi::constructor]
    pub fn new(
        client: Arc<LlmClient>,
        brain: Arc<MarieBrain>,
        memory: Arc<SlidingWindowMemory>,
        router: Option<Arc<ModelRouter>>,
        host_executor: Option<Box<dyn ToolExecutor>>,
        default_model: String,
    ) -> Self {
        let mut registry = ToolRegistry::new();
        
        // Register default native tools
        registry.register(Box::new(crate::tools::web_search::WebSearch));
        registry.register(Box::new(crate::tools::web_fetch::WebFetch));
        registry.register(Box::new(crate::tools::calculator::Calculator));
        registry.register(Box::new(crate::tools::shell::Shell));

        // Inject native tool definitions into the brain automatically
        for def in registry.get_definitions() {
            brain.register_tool(def);
        }

        Self {
            client,
            brain,
            memory,
            router,
            registry: Arc::new(registry),
            host_executor,
            default_model,
        }
    }

    pub fn brain(&self) -> Arc<MarieBrain> {
        self.brain.clone()
    }

    pub fn chat(&self, user_message: String) -> Result<String, MarieError> {
        self.memory.add(Message {
            role: "user".to_string(),
            content: Some(user_message.clone()),
            tool_calls: None,
            tool_call_id: None,
        });

        let mut current_step = 0;
        let max_steps = self.brain.budget().max_steps.unwrap_or(15);
        let mut tool_call_history: std::collections::HashSet<String> = std::collections::HashSet::new();

        loop {
            current_step += 1;
            if current_step > max_steps {
                return Err(MarieError::Internal("Maximum agent steps reached.".to_string()));
            }

            let has_tools = !self.brain.tools().is_empty();
            let model = if let Some(ref r) = self.router {
                r.route(user_message.clone(), has_tools, self.default_model.clone())
            } else {
                self.default_model.clone()
            };

            let history = self.memory.get_history();
            let tools = self.brain.tools();

            let response_msg = self.client.complete(model, history, Some(tools))?;
            self.brain.track_usage(100, 0.001);

            if let Some(ref calls) = response_msg.tool_calls {
                if !calls.is_empty() {
                    self.memory.add(response_msg.clone());
                    for tc in calls {
                        // Loop protection: detect repeated calls with same arguments
                        let call_key = format!("{}:{}", tc.function.name, tc.function.arguments);
                        if tool_call_history.contains(&call_key) {
                            return Err(MarieError::Internal(format!("Agent detected an infinite loop with tool '{}'.", tc.function.name)));
                        }
                        tool_call_history.insert(call_key);

                        let result = if !self.brain.is_tool_allowed(tc.function.name.clone()) {
                            format!("Error: Tool '{}' is blocked by safe_mode.", tc.function.name)
                        } else if let Some(native_tool) = self.registry.get_tool(&tc.function.name) {
                            // Execute natively in Rust
                            native_tool.execute(tc.function.arguments.clone())
                        } else if let Some(ref host) = self.host_executor {
                            // Delegate to host (Python/JS)
                            host.execute(tc.function.name.clone(), tc.function.arguments.clone())
                        } else {
                            format!("Error: Tool '{}' not found in Rust Registry and no Host Executor provided.", tc.function.name)
                        };

                        self.memory.add(Message {
                            role: "tool".to_string(),
                            content: Some(result),
                            tool_calls: None,
                            tool_call_id: Some(tc.id.clone()),
                        });
                    }
                    current_step += 1;
                    continue; 
                }
            }
            let mut content = response_msg.content.clone().unwrap_or_default();
            if content.is_empty() {
                content = "I'm sorry, I couldn't generate a response for that. Could you try rephrasing?".to_string();
            }
            self.memory.add(response_msg);
            
            // Auto-save session after successful turn
            let _ = self.memory.save();
            
            return Ok(content);
        }
    }

    pub fn save_session(&self) -> Result<(), MarieError> {
        self.memory.save()
    }
}
