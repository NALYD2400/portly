use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub id: String,
    pub name: String,
    pub command: String,
    pub port: u16,
    pub state: String, // "stopped", "running", "error"
    pub healthy: bool,
    #[serde(default)]
    pub env: std::collections::HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectConfig {
    pub id: String,
    pub name: String,
    pub root: String,
    pub color: String,
    pub icon: String,
    #[serde(default)]
    pub framework: Option<String>,
    #[serde(default)]
    pub branch: Option<String>,
    #[serde(default)]
    pub servers: Vec<ServerConfig>,
}

pub fn get_config_dir() -> PathBuf {
    let mut dir = dirs_next::config_dir().unwrap_or_else(|| PathBuf::from("."));
    dir.push("portly");
    let _ = fs::create_dir_all(&dir);
    dir
}

pub fn get_projects_file() -> PathBuf {
    let mut file = get_config_dir();
    file.push("projects.json");
    file
}

pub fn load_projects() -> Vec<ProjectConfig> {
    let file = get_projects_file();
    if file.exists() {
        if let Ok(content) = fs::read_to_string(&file) {
            if let Ok(projects) = serde_json::from_str::<Vec<ProjectConfig>>(&content) {
                return projects;
            }
        }
    }
    Vec::new()
}

pub fn save_projects(projects: &[ProjectConfig]) -> Result<(), String> {
    let file = get_projects_file();
    let json = serde_json::to_string_pretty(projects).map_err(|e| e.to_string())?;
    fs::write(file, json).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_shortcut_file() -> PathBuf {
    let mut file = get_config_dir();
    file.push("shortcut.txt");
    file
}

pub fn load_saved_shortcut() -> String {
    let file = get_shortcut_file();
    if file.exists() {
        if let Ok(content) = fs::read_to_string(&file) {
            let trimmed = content.trim();
            if !trimmed.is_empty() {
                return trimmed.to_string();
            }
        }
    }
    "Ctrl+Alt+P".to_string()
}

pub fn save_saved_shortcut(shortcut: &str) -> Result<(), String> {
    let file = get_shortcut_file();
    fs::write(file, shortcut).map_err(|e| e.to_string())
}
