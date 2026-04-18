use std::sync::Mutex;
use crate::models::{Message, PersistenceConfig, MarieError};
use crate::interfaces::{Summarizer, PersistenceProvider};
use crate::persistence::PersistenceEngine;

#[derive(uniffi::Object)]
pub struct SlidingWindowMemory {
    full_history: Mutex<Vec<Message>>,
    summary: Mutex<Option<String>>,
    recent_turns: u32,
    summarizer: Option<Box<dyn Summarizer>>,
    persistence: PersistenceEngine,
    user_id: Option<String>,
}

#[uniffi::export]
impl SlidingWindowMemory {
    #[uniffi::constructor]
    pub fn new(
        recent_turns: Option<u32>, 
        summarizer: Option<Box<dyn Summarizer>>,
        persistence_config: PersistenceConfig,
        host_persistence: Option<Box<dyn PersistenceProvider>>,
        user_id: Option<String>,
    ) -> Self {
        let persistence = PersistenceEngine::new(persistence_config, host_persistence);
        
        // Load existing STM if persistence exists
        let existing_stm = persistence.load_stm(user_id.clone()).unwrap_or_default();
        let summary = existing_stm.last().cloned();

        Self {
            full_history: Mutex::new(Vec::new()),
            summary: Mutex::new(summary),
            recent_turns: recent_turns.unwrap_or(10),
            summarizer,
            persistence,
            user_id,
        }
    }

    pub fn add(&self, message: Message) {
        self.full_history.lock().unwrap().push(message);
    }

    pub fn save(&self) -> Result<(), MarieError> {
        let summary = self.summary.lock().unwrap();
        let summaries = summary.as_ref().map(|s| vec![s.clone()]).unwrap_or_default();
        self.persistence.save_stm(self.user_id.clone(), summaries)
    }

    pub fn get_history(&self) -> Vec<Message> {
        let max_messages = (self.recent_turns * 2) as usize;
        let mut history = self.full_history.lock().unwrap();
        let mut summary = self.summary.lock().unwrap();

        if history.len() <= max_messages {
            return self.build_history_with_summary(&history, &summary);
        }

        let split_idx = history.len() - max_messages;
        let old_messages: Vec<Message> = history.iter().take(split_idx).cloned().collect();
        let recent_messages: Vec<Message> = history.iter().skip(split_idx).cloned().collect();

        if let Some(ref s) = self.summarizer {
            if !old_messages.is_empty() {
                let new_summary = s.summarize(old_messages);
                *summary = Some(new_summary);
                *history = recent_messages.clone();
                // Auto-save on summarization
                let _ = self.persistence.save_stm(self.user_id.clone(), vec![summary.as_ref().unwrap().clone()]);
            }
        }

        self.build_history_with_summary(&history, &summary)
    }

    fn build_history_with_summary(&self, history: &[Message], summary_text: &Option<String>) -> Vec<Message> {
        let mut result = Vec::new();
        if let Some(ref sum) = *summary_text {
            result.push(Message {
                role: "user".to_string(),
                content: Some(format!("[Earlier conversation summary]: {}", sum)),
                tool_calls: None,
                tool_call_id: None,
            });
            result.push(Message {
                role: "assistant".to_string(),
                content: Some("Understood. I have context of the earlier conversation.".to_string()),
                tool_calls: None,
                tool_call_id: None,
            });
        }
        result.extend(history.iter().cloned());
        result
    }
}
