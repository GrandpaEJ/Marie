use crate::models::Message;

#[uniffi::export(callback_interface)]
pub trait ToolExecutor: Send + Sync {
    fn execute(&self, name: String, args: String) -> String;
}

#[uniffi::export(callback_interface)]
pub trait Summarizer: Send + Sync {
    fn summarize(&self, messages: Vec<Message>) -> String;
}
