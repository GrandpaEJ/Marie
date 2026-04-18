use std::fs::File;
use std::io::{Read, Write};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use crate::models::{LtmNode, MarieError, PersistenceConfig};
use crate::interfaces::PersistenceProvider;

pub struct PersistenceEngine {
    config: PersistenceConfig,
    host_provider: Option<Box<dyn PersistenceProvider>>,
}

#[derive(Serialize, Deserialize)]
struct JsonSnapshot {
    ltm: Vec<LtmNode>,
    stm: Vec<String>,
}

impl PersistenceEngine {
    pub fn new(config: PersistenceConfig, host_provider: Option<Box<dyn PersistenceProvider>>) -> Self {
        if let PersistenceConfig::Sqlite { ref path } = config {
            let conn = Connection::open(path).expect("Failed to open SQLite DB");
            conn.execute_batch(
                "PRAGMA journal_mode = WAL;
                 CREATE TABLE IF NOT EXISTS ltm_nodes (
                    id TEXT PRIMARY KEY,
                    user_id TEXT,
                    content TEXT NOT NULL,
                    category TEXT NOT NULL,
                    importance REAL NOT NULL,
                    created_at INTEGER NOT NULL,
                    last_accessed_at INTEGER NOT NULL,
                    access_count INTEGER NOT NULL,
                    tags TEXT NOT NULL,
                    source TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS stm_summaries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT,
                    content TEXT NOT NULL
                );"
            ).expect("Failed to init SQLite tables");
        }
        Self { config, host_provider }
    }

    pub fn save_ltm(&self, nodes: Vec<LtmNode>) -> Result<(), MarieError> {
        match self.config {
            PersistenceConfig::None => Ok(()),
            PersistenceConfig::Sqlite { ref path } => {
                let conn = Connection::open(path).map_err(|e| MarieError::Persistence(e.to_string()))?;
                for node in nodes {
                    conn.execute(
                        "INSERT INTO ltm_nodes (id, user_id, content, category, importance, created_at, last_accessed_at, access_count, tags, source)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                         ON CONFLICT(id) DO UPDATE SET
                            importance = excluded.importance,
                            last_accessed_at = excluded.last_accessed_at,
                            access_count = excluded.access_count",
                        params![
                            node.id, node.user_id, node.content, node.category,
                            node.importance, node.created_at, node.last_accessed_at,
                            node.access_count, serde_json::to_string(&node.tags).unwrap(), node.source
                        ],
                    ).map_err(|e| MarieError::Persistence(e.to_string()))?;
                }
                Ok(())
            }
            PersistenceConfig::Json { .. } => {
                let mut snapshot = self.load_snapshot().unwrap_or(JsonSnapshot { ltm: Vec::new(), stm: Vec::new() });
                for node in nodes {
                    if let Some(pos) = snapshot.ltm.iter().position(|n| n.id == node.id) {
                        snapshot.ltm[pos] = node;
                    } else {
                        snapshot.ltm.push(node);
                    }
                }
                self.save_snapshot(snapshot)
            }
            PersistenceConfig::Host => {
                if let Some(ref p) = self.host_provider {
                    p.save_ltm(nodes);
                    Ok(())
                } else {
                    Err(MarieError::Internal("Host persistence provider not set".to_string()))
                }
            }
        }
    }

    pub fn load_ltm(&self, user_id: Option<String>) -> Result<Vec<LtmNode>, MarieError> {
        match self.config {
            PersistenceConfig::None => Ok(Vec::new()),
            PersistenceConfig::Sqlite { ref path } => {
                let conn = Connection::open(path).map_err(|e| MarieError::Persistence(e.to_string()))?;
                let mut list = Vec::new();
                if let Some(uid) = user_id {
                    let mut stmt = conn.prepare("SELECT id, user_id, content, category, importance, created_at, last_accessed_at, access_count, tags, source FROM ltm_nodes WHERE user_id = ?").map_err(|e| MarieError::Persistence(e.to_string()))?;
                    let rows = stmt.query_map([uid], |row| self.map_ltm_row(row)).map_err(|e| MarieError::Persistence(e.to_string()))?;
                    for r in rows {
                        list.push(r.map_err(|e| MarieError::Persistence(e.to_string()))?);
                    }
                } else {
                    let mut stmt = conn.prepare("SELECT id, user_id, content, category, importance, created_at, last_accessed_at, access_count, tags, source FROM ltm_nodes").map_err(|e| MarieError::Persistence(e.to_string()))?;
                    let rows = stmt.query_map([], |row| self.map_ltm_row(row)).map_err(|e| MarieError::Persistence(e.to_string()))?;
                    for r in rows {
                        list.push(r.map_err(|e| MarieError::Persistence(e.to_string()))?);
                    }
                }
                Ok(list)
            }
            PersistenceConfig::Json { .. } => {
                let snapshot = self.load_snapshot()?;
                if let Some(uid) = user_id {
                    Ok(snapshot.ltm.into_iter().filter(|n| n.user_id == Some(uid.clone())).collect())
                } else {
                    Ok(snapshot.ltm)
                }
            }
            PersistenceConfig::Host => {
                if let Some(ref p) = self.host_provider {
                    Ok(p.load_ltm(user_id))
                } else {
                    Err(MarieError::Internal("Host persistence provider not set".to_string()))
                }
            }
        }
    }

    pub fn save_stm(&self, user_id: Option<String>, summaries: Vec<String>) -> Result<(), MarieError> {
         match self.config {
            PersistenceConfig::None => Ok(()),
            PersistenceConfig::Sqlite { ref path } => {
                let mut conn = Connection::open(path).map_err(|e| MarieError::Persistence(e.to_string()))?;
                let tx = conn.transaction().map_err(|e| MarieError::Persistence(e.to_string()))?;
                if let Some(ref uid) = user_id {
                    tx.execute("DELETE FROM stm_summaries WHERE user_id = ?1", params![uid]).map_err(|e| MarieError::Persistence(e.to_string()))?;
                } else {
                    tx.execute("DELETE FROM stm_summaries", []).map_err(|e| MarieError::Persistence(e.to_string()))?;
                }
                for s in summaries {
                    tx.execute("INSERT INTO stm_summaries (user_id, content) VALUES (?1, ?2)", params![user_id.clone(), s]).map_err(|e| MarieError::Persistence(e.to_string()))?;
                }
                tx.commit().map_err(|e| MarieError::Persistence(e.to_string()))
            }
            PersistenceConfig::Json { .. } => {
                let mut snapshot = self.load_snapshot().unwrap_or(JsonSnapshot { ltm: Vec::new(), stm: Vec::new() });
                snapshot.stm = summaries;
                self.save_snapshot(snapshot)
            }
            PersistenceConfig::Host => {
                if let Some(ref p) = self.host_provider {
                    p.save_stm(user_id, summaries);
                    Ok(())
                } else {
                    Err(MarieError::Internal("Host persistence provider not set".to_string()))
                }
            }
        }
    }

    pub fn load_stm(&self, user_id: Option<String>) -> Result<Vec<String>, MarieError> {
        match self.config {
            PersistenceConfig::None => Ok(Vec::new()),
            PersistenceConfig::Sqlite { ref path } => {
                let conn = Connection::open(path).map_err(|e| MarieError::Persistence(e.to_string()))?;
                let mut list = Vec::new();
                if let Some(uid) = user_id {
                    let mut stmt = conn.prepare("SELECT content FROM stm_summaries WHERE user_id = ? ORDER BY id").map_err(|e| MarieError::Persistence(e.to_string()))?;
                    let rows = stmt.query_map([uid], |row| row.get::<_, String>(0)).map_err(|e| MarieError::Persistence(e.to_string()))?;
                    for r in rows {
                        list.push(r.map_err(|e| MarieError::Persistence(e.to_string()))?);
                    }
                } else {
                    let mut stmt = conn.prepare("SELECT content FROM stm_summaries ORDER BY id").map_err(|e| MarieError::Persistence(e.to_string()))?;
                    let rows = stmt.query_map([], |row| row.get::<_, String>(0)).map_err(|e| MarieError::Persistence(e.to_string()))?;
                    for r in rows {
                        list.push(r.map_err(|e| MarieError::Persistence(e.to_string()))?);
                    }
                }
                Ok(list)
            }
            PersistenceConfig::Json { .. } => {
                let snapshot = self.load_snapshot()?;
                Ok(snapshot.stm)
            }
            PersistenceConfig::Host => {
                if let Some(ref p) = self.host_provider {
                    Ok(p.load_stm(user_id))
                } else {
                    Err(MarieError::Internal("Host persistence provider not set".to_string()))
                }
            }
        }
    }

    fn map_ltm_row(&self, row: &rusqlite::Row) -> rusqlite::Result<LtmNode> {
        let tags_str: String = row.get(8)?;
        Ok(LtmNode {
            id: row.get(0)?,
            user_id: row.get(1)?,
            content: row.get(2)?,
            category: row.get(3)?,
            importance: row.get(4)?,
            created_at: row.get(5)?,
            last_accessed_at: row.get(6)?,
            access_count: row.get(7)?,
            tags: serde_json::from_str(&tags_str).unwrap_or_default(),
            source: row.get(9)?,
        })
    }

    fn load_snapshot(&self) -> Result<JsonSnapshot, MarieError> {
        if let PersistenceConfig::Json { ref path } = self.config {
            let mut file = match File::open(path) {
                Ok(f) => f,
                Err(_) => return Ok(JsonSnapshot { ltm: Vec::new(), stm: Vec::new() }),
            };
            let mut content = String::new();
            file.read_to_string(&mut content).map_err(|e| MarieError::Persistence(e.to_string()))?;
            serde_json::from_str(&content).map_err(|e| MarieError::Persistence(e.to_string()))
        } else {
            Err(MarieError::Internal("Not a JSON config".to_string()))
        }
    }

    fn save_snapshot(&self, snapshot: JsonSnapshot) -> Result<(), MarieError> {
        if let PersistenceConfig::Json { ref path } = self.config {
            let content = serde_json::to_string_pretty(&snapshot).map_err(|e| MarieError::Persistence(e.to_string()))?;
            let mut file = File::create(path).map_err(|e| MarieError::Persistence(e.to_string()))?;
            file.write_all(content.as_bytes()).map_err(|e| MarieError::Persistence(e.to_string()))
        } else {
            Err(MarieError::Internal("Not a JSON config".to_string()))
        }
    }
}
