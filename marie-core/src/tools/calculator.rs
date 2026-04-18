use crate::tools::NativeTool;
use crate::models::ToolDefinition;
use serde_json::Value;

pub struct Calculator;

impl NativeTool for Calculator {
    fn name(&self) -> String {
        "calculator".to_string()
    }

    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            name: self.name(),
            description: "Perform basic mathematical calculations (+, -, *, /).".to_string(),
            parameters_json: r#"{
                "type": "object",
                "properties": {
                    "expression": { "type": "string", "description": "The math expression to evaluate, e.g., '15 * 5'" }
                },
                "required": ["expression"]
            }"#.to_string(),
            safe: true,
        }
    }

    fn execute(&self, args: String) -> String {
        let json: Value = match serde_json::from_str(&args) {
            Ok(v) => v,
            Err(_) => return "Error: Invalid JSON arguments.".to_string(),
        };

        let expr = match json["expression"].as_str() {
            Some(e) => e,
            None => return "Error: Missing 'expression' parameter.".to_string(),
        };

        // Basic arithmetic regex-based evaluator (very simple for demo)
        // In a real app, we'd use a crate like `meval` or `evalexpr`
        let parts: Vec<&str> = expr.split_whitespace().collect();
        if parts.len() == 3 {
            let a: f64 = parts[0].parse().unwrap_or(0.0);
            let op = parts[1];
            let b: f64 = parts[2].parse().unwrap_or(0.0);

            let result = match op {
                "+" => a + b,
                "-" => a - b,
                "*" => a * b,
                "/" => if b != 0.0 { a / b } else { return "Error: Division by zero.".to_string() },
                _ => return format!("Error: Unsupported operator '{}'. Use +, -, *, /", op),
            };
            return result.to_string();
        }

        "Error: Expression must be in format 'X op Y' (e.g. '10 + 20').".to_string()
    }
}
