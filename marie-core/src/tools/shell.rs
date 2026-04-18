use crate::tools::NativeTool;
use crate::models::ToolDefinition;
use serde_json::Value;
use std::process::Command;

pub struct Shell;

impl NativeTool for Shell {
    fn name(&self) -> String {
        "shell".to_string()
    }

    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            name: self.name(),
            description: "Execute a shell command on the host system. High privilege tool.".to_string(),
            parameters_json: r#"{
                "type": "object",
                "properties": {
                    "command": { "type": "string", "description": "The command to run" }
                },
                "required": ["command"]
            }"#.to_string(),
            safe: false, // <--- EXTREMELY IMPORTANT: Handled by MarieBrain safe_mode
        }
    }

    fn execute(&self, args: String) -> String {
        let json: Value = match serde_json::from_str(&args) {
            Ok(v) => v,
            Err(_) => return "Error: Invalid JSON arguments.".to_string(),
        };

        let cmd_str = match json["command"].as_str() {
            Some(c) => c,
            None => return "Error: Missing 'command' parameter.".to_string(),
        };

        let output = if cfg!(target_os = "windows") {
            Command::new("cmd").args(["/C", cmd_str]).output()
        } else {
            Command::new("sh").args(["-c", cmd_str]).output()
        };

        match output {
            Ok(out) => {
                let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                
                if out.status.success() {
                    if stdout.is_empty() { "Command executed successfully (no output).".to_string() }
                    else { stdout }
                } else {
                    format!("Command failed with code {:?}\nStderr: {}", out.status.code(), stderr)
                }
            }
            Err(e) => format!("Execution Error: {}", e),
        }
    }
}
