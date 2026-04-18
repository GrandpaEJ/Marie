use std::collections::HashMap;
use regex::Regex;
use once_cell::sync::Lazy;
use crate::models::ModelTier;

static NANO_PATTERNS: Lazy<Vec<Regex>> = Lazy::new(|| {
    vec![
        Regex::new(r"(?i)^(what is|what's|who is|who's|when did|when is|how many|how much)\b").unwrap(),
        Regex::new(r"(?i)\b(translate|convert|format|summarize in one sentence)\b").unwrap(),
        Regex::new(r"^[\d\s+\-*/()^.]+$").unwrap(),
    ]
});

static FRONTIER_PATTERNS: Lazy<Vec<Regex>> = Lazy::new(|| {
    vec![
        Regex::new(r"(?i)\b(architect|design|implement|refactor|debug|analyze|reason|strategize)\b").unwrap(),
        Regex::new(r"(?i)\b(write (a |the )?(full|complete|production|complex))\b").unwrap(),
        Regex::new(r"(?i)\b(compare and contrast|pros and cons|tradeoffs)\b").unwrap(),
        Regex::new(r"(?i)\b(step[- ]by[- ]step|detailed plan|comprehensive)\b").unwrap(),
    ]
});

pub fn classify_tier(message: &str, has_tools: bool) -> ModelTier {
    if !has_tools {
        let words = message.split_whitespace().count();
        if words <= 20 && NANO_PATTERNS.iter().any(|re| re.is_match(message)) {
            return ModelTier::Nano;
        }
    }
    let words = message.split_whitespace().count();
    if words > 80 || FRONTIER_PATTERNS.iter().any(|re| re.is_match(message)) {
        return ModelTier::Frontier;
    }
    ModelTier::Fast
}

#[derive(uniffi::Object)]
pub struct ModelRouter {
    tier_map: HashMap<ModelTier, String>,
    default_tier: ModelTier,
}

#[uniffi::export]
impl ModelRouter {
    #[uniffi::constructor]
    pub fn new(nano: Option<String>, fast: Option<String>, frontier: Option<String>, default_tier: Option<ModelTier>) -> Self {
        let mut tier_map = HashMap::new();
        if let Some(m) = nano { tier_map.insert(ModelTier::Nano, m); }
        if let Some(m) = fast { tier_map.insert(ModelTier::Fast, m); }
        if let Some(m) = frontier { tier_map.insert(ModelTier::Frontier, m); }
        Self {
            tier_map,
            default_tier: default_tier.unwrap_or(ModelTier::Fast),
        }
    }

    pub fn route(&self, message: String, has_tools: bool, fallback: String) -> String {
        let tier = classify_tier(&message, has_tools);
        self.tier_map.get(&tier)
            .or_else(|| self.tier_map.get(&self.default_tier))
            .cloned()
            .unwrap_or(fallback)
    }
}
