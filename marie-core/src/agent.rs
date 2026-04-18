use std::sync::Arc;
use crate::models::{Message, MarieError};
use crate::brain::MarieBrain;
use crate::client::LlmClient;
use crate::memory::SlidingWindowMemory;
use crate::routing::ModelRouter;
use crate::interfaces::ToolExecutor;

#[derive(uniffi::Object)]
pub struct MarieAgent {
    client: Arc<LlmClient>,
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
        client: Arc<LlmClient>,
        brain: Arc<MarieBrain>,
        memory: Arc<SlidingWindowMemory>,
        router: Option<Arc<ModelRouter>>,
        executor: Box<dyn ToolExecutor>,
        default_model: String,
    ) -> Self {
        Self {
            client,
            brain,
            memory,
            router,
            executor,
            default_model,
        }
    }

    pub fn chat(&self, user_message: String) -> Result<String, MarieError> {
        self.memory.add(Message {
            role: "user".to_string(),
            content: Some(user_message.clone()),
            tool_calls: None,
            tool_call_id: None,
        });

        let mut current_step = 0;
        loop {
            if current_step >= 10 {
                return Err(MarieError::Internal("Maximum agent steps reached.".to_string()));
            }

            let has_tools = !self.brain.get_tool_definitions().is_empty();
            let model = if let Some(ref r) = self.router {
                r.route(user_message.clone(), has_tools, self.default_model.clone())
            } else {
                self.default_model.clone()
            };

            let history = self.memory.get_history();
            let tools = self.brain.get_tool_definitions();

            let response_msg = self.client.complete(model, history, Some(tools))?;
            self.brain.track_usage(100, 0.001);

            if let Some(ref calls) = response_msg.tool_calls {
                if !calls.is_empty() {
                    self.memory.add(response_msg.clone());
                    for tc in calls {
                        let result = if !self.brain.is_tool_allowed(tc.name.clone()) {
                            format!("Error: Tool '{}' is blocked by safe_mode.", tc.name)
                        } else {
                             self.executor.execute(tc.name.clone(), tc.arguments.clone())
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
            let content = response_msg.content.clone().unwrap_or_default();
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
