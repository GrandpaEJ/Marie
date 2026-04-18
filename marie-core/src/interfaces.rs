use crate::models::{Message, LtmNode};

#[uniffi::export(callback_interface)]
pub trait ToolExecutor: Send + Sync {
    fn execute(&self, name: String, args: String) -> String;
}

#[uniffi::export(callback_interface)]
pub trait Summarizer: Send + Sync {
    fn summarize(&self, messages: Vec<Message>) -> String;
}

#[uniffi::export(callback_interface)]
pub trait PersistenceProvider: Send + Sync {
    fn save_ltm(&self, nodes: Vec<LtmNode>);
    fn load_ltm(&self, user_id: Option<String>) -> Vec<LtmNode>;
    fn save_stm(&self, user_id: Option<String>, summaries: Vec<String>);
    fn load_stm(&self, user_id: Option<String>) -> Vec<String>;
}
