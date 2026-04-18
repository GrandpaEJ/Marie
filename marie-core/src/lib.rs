use std::sync::Mutex;

#[derive(uniffi::Record, Clone)]
pub struct Message {
    pub role: String,
    pub content: Option<String>,
}

#[derive(uniffi::Record, Clone, Copy)]
pub struct Budget {
    pub max_tokens: Option<u32>,
    pub max_cost_usd: Option<f64>,
    pub max_steps: Option<u32>,
}

#[derive(uniffi::Object)]
pub struct MarieBrain {
    history: Mutex<Vec<Message>>,
    budget: Budget,
    total_tokens: Mutex<u32>,
    total_cost: Mutex<f64>,
    steps: Mutex<u32>,
}

#[uniffi::export]
impl MarieBrain {
    #[uniffi::constructor]
    pub fn new(budget: Budget) -> Self {
        Self {
            history: Mutex::new(Vec::new()),
            budget,
            total_tokens: Mutex::new(0),
            total_cost: Mutex::new(0.0),
            steps: Mutex::new(0),
        }
    }

    pub fn add_message(&self, role: String, content: Option<String>) {
        let mut history = self.history.lock().unwrap();
        history.push(Message { role, content });
    }

    pub fn get_history(&self) -> Vec<Message> {
        self.history.lock().unwrap().clone()
    }

    pub fn track_usage(&self, tokens: u32, cost_usd: f64) -> bool {
        let mut total_tokens = self.total_tokens.lock().unwrap();
        let mut total_cost = self.total_cost.lock().unwrap();
        let mut steps = self.steps.lock().unwrap();

        *total_tokens += tokens;
        *total_cost += cost_usd;
        *steps += 1;

        // Budget Enforcements
        if let Some(max) = self.budget.max_tokens {
            if *total_tokens > max { return false; }
        }
        if let Some(max) = self.budget.max_cost_usd {
            if *total_cost > max { return false; }
        }
        if let Some(max) = self.budget.max_steps {
            if *steps > max { return false; }
        }

        true
    }

    pub fn get_metrics(&self) -> Metrics {
        Metrics {
            tokens: *self.total_tokens.lock().unwrap(),
            cost_usd: *self.total_cost.lock().unwrap(),
            steps: *self.steps.lock().unwrap(),
        }
    }
}

#[derive(uniffi::Record)]
pub struct Metrics {
    pub tokens: u32,
    pub cost_usd: f64,
    pub steps: u32,
}

uniffi::setup_scaffolding!();
