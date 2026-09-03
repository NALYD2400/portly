use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    #[serde(default = "default_hex")]
    pub custom_hex: String,
    #[serde(default = "default_true")]
    pub canvas_bg: bool,
    #[serde(default = "default_false")]
    pub auto_restart: bool,
    #[serde(default = "default_true")]
    pub hide_stopped_servers: bool,
    #[serde(default = "default_true")]
    pub clean_ansi_logs: bool,
    #[serde(default = "default_true")]
    pub minimize_to_tray: bool,
    #[serde(default = "default_true")]
    pub notif_windows: bool,
    #[serde(default = "default_true")]
    pub notif_app: bool,
    #[serde(default = "default_shortcut")]
    pub global_shortcut: String,
    #[serde(default = "default_false")]
    pub autostart: bool,
}

fn default_hex() -> String {
    "#a855f7".to_string()
}
fn default_shortcut() -> String {
    "Ctrl+Alt+P".to_string()
}
fn default_true() -> bool {
    true
}
fn default_false() -> bool {
    false
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            custom_hex: default_hex(),
            canvas_bg: true,
            auto_restart: false,
            hide_stopped_servers: true,
            clean_ansi_logs: true,
            minimize_to_tray: true,
            notif_windows: true,
            notif_app: true,
            global_shortcut: default_shortcut(),
            autostart: false,
        }
    }
}

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
    #[serde(rename = "ramLimit", default)]
    pub ram_limit: Option<u32>,
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
    let base = dirs_next::config_dir().unwrap_or_else(|| PathBuf::from("."));
    let dir = base.join("sprint");
    if !dir.exists() {
        let legacy = base.join("portly");
        if legacy.exists() {
            let _ = fs::create_dir_all(&dir);
            if let Ok(content) = fs::read_to_string(legacy.join("projects.json")) {
                let _ = fs::write(dir.join("projects.json"), content);
            }
            if let Ok(content) = fs::read_to_string(legacy.join("settings.json")) {
                let _ = fs::write(dir.join("settings.json"), content);
            }
        }
    }
    let _ = fs::create_dir_all(&dir);
    dir
}

pub fn get_projects_file() -> PathBuf {
    get_config_dir().join("projects.json")
}

pub fn get_settings_file() -> PathBuf {
    get_config_dir().join("settings.json")
}

pub fn get_crash_log_file() -> PathBuf {
    get_config_dir().join("crash.log")
}

/// Écriture atomique : écrit dans un fichier temporaire puis renomme.
pub fn atomic_write(path: &Path, contents: &str) -> Result<(), String> {
    let tmp_path = path.with_extension("tmp");

    fs::write(&tmp_path, contents).map_err(|e| format!("Erreur écriture {}: {}", tmp_path.display(), e))?;

    if path.exists() {
        let bak_path = path.with_extension("bak");
        let _ = fs::remove_file(&bak_path);
        let _ = fs::rename(path, &bak_path);
    }

    fs::rename(&tmp_path, path).map_err(|e| format!("Erreur finalisation {}: {}", path.display(), e))?;
    Ok(())
}

pub fn load_projects() -> Vec<ProjectConfig> {
    let file = get_projects_file();
    if file.exists() {
        if let Ok(content) = fs::read_to_string(&file) {
            match serde_json::from_str::<Vec<ProjectConfig>>(&content) {
                Ok(mut projects) => {
                    for prj in &mut projects {
                        for srv in &mut prj.servers {
                            srv.state = "stopped".to_string();
                            srv.healthy = false;
                        }
                    }
                    return projects;
                }
                Err(e) => {
                    let quarantine = get_config_dir().join(format!(
                        "projects.corrupt-{}.json",
                        std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .map(|d| d.as_secs())
                            .unwrap_or(0)
                    ));
                    let _ = fs::rename(&file, &quarantine);
                    eprintln!(
                        "Sprint: projects.json illisible ({}) — mis en quarantaine dans {}",
                        e,
                        quarantine.display()
                    );
                }
            }
        }
    }
    Vec::new()
}

pub fn save_projects(projects: &[ProjectConfig]) -> Result<(), String> {
    let json = serde_json::to_string_pretty(projects).map_err(|e| e.to_string())?;
    atomic_write(&get_projects_file(), &json)
}

pub fn get_shortcut_file() -> PathBuf {
    get_config_dir().join("shortcut.txt")
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
    atomic_write(&get_shortcut_file(), shortcut)
}

pub fn load_settings() -> AppSettings {
    let file = get_settings_file();
    if file.exists() {
        if let Ok(content) = fs::read_to_string(&file) {
            if let Ok(settings) = serde_json::from_str::<AppSettings>(&content) {
                return settings;
            }
        }
    }
    let legacy_shortcut = load_saved_shortcut();
    AppSettings {
        custom_hex: default_hex(),
        canvas_bg: true,
        auto_restart: false,
        hide_stopped_servers: true,
        clean_ansi_logs: true,
        minimize_to_tray: true,
        notif_windows: true,
        notif_app: true,
        global_shortcut: if !legacy_shortcut.is_empty() { legacy_shortcut } else { default_shortcut() },
        autostart: false,
    }
}

pub fn save_settings(settings: &AppSettings) -> Result<(), String> {
    let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    atomic_write(&get_settings_file(), &json)
}

pub fn list_env_files_in_dir(project_root: &Path) -> Vec<String> {
    let mut list = Vec::new();
    if let Ok(entries) = fs::read_dir(project_root) {
        for entry in entries.flatten() {
            if let Ok(file_name) = entry.file_name().into_string() {
                if file_name == ".env" || file_name.starts_with(".env.") {
                    list.push(file_name);
                }
            }
        }
    }
    if list.is_empty() {
        list.push(".env".to_string());
    } else {
        list.sort();
    }
    list
}
