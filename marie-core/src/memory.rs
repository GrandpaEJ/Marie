use std::sync::Mutex;
use crate::models::Message;
use crate::interfaces::Summarizer;

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
        Self {
            full_history: Mutex::new(Vec::new()),
            summary: Mutex::new(None),
            recent_turns: recent_turns.unwrap_or(10),
            summarizer,
        }
    }

    pub fn add(&self, message: Message) {
        let mut history = self.full_history.lock().unwrap();
        history.push(message);
    }

    pub fn get_history(&self) -> Vec<Message> {
        let max_messages = (self.recent_turns * 2) as usize;
        let mut history = self.full_history.lock().unwrap();
        let mut summary = self.summary.lock().unwrap();

        if history.len() <= max_messages {
            return history.clone();
        }

        let split_idx = history.len() - max_messages;
        let old_messages: Vec<Message> = history.iter().take(split_idx).cloned().collect();
        let recent_messages: Vec<Message> = history.iter().skip(split_idx).cloned().collect();

        if let Some(ref s) = self.summarizer {
            if !old_messages.is_empty() {
                let new_summary = s.summarize(old_messages);
                *summary = Some(new_summary);
                *history = recent_messages.clone();
            }
        }

        let mut result = Vec::new();
        if let Some(ref sum_text) = *summary {
            result.push(Message {
                role: "user".to_string(),
                content: Some(format!("[Earlier conversation summary]: {}", sum_text)),
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
        result.extend(recent_messages);
        result
    }
}
