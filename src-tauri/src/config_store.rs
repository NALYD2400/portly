use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

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
    let mut dir = dirs_next::config_dir().unwrap_or_else(|| PathBuf::from("."));
    dir.push("portly");
    let _ = fs::create_dir_all(&dir);
    dir
}

pub fn get_projects_file() -> PathBuf {
    get_config_dir().join("projects.json")
}

pub fn get_crash_log_file() -> PathBuf {
    get_config_dir().join("crash.log")
}

/// Écriture atomique : écrit dans un fichier temporaire puis renomme.
/// Un crash en pleine écriture ne peut plus tronquer le fichier d'origine.
pub fn atomic_write(path: &Path, contents: &str) -> Result<(), String> {
    let tmp_path = path.with_extension("tmp");

    fs::write(&tmp_path, contents).map_err(|e| format!("Erreur écriture {}: {}", tmp_path.display(), e))?;

    if path.exists() {
        let bak_path = path.with_extension("bak");
        let _ = fs::remove_file(&bak_path);
        fs::rename(path, &bak_path)
            .map_err(|e| format!("Erreur sauvegarde de {}: {}", path.display(), e))?;
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
                    // L'état "running" persisté n'a plus de sens au lancement :
                    // le process manager démarre vide. On réconcilie ici.
                    for prj in &mut projects {
                        for srv in &mut prj.servers {
                            srv.state = "stopped".to_string();
                            srv.healthy = false;
                        }
                    }
                    return projects;
                }
                Err(e) => {
                    // Fichier corrompu : on le met en quarantaine plutôt que de
                    // risquer son écrasement silencieux à la prochaine sauvegarde.
                    let quarantine = get_config_dir().join(format!(
                        "projects.corrupt-{}.json",
                        std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .map(|d| d.as_secs())
                            .unwrap_or(0)
                    ));
                    let _ = fs::rename(&file, &quarantine);
                    eprintln!(
                        "Portly: projects.json illisible ({}) — mis en quarantaine dans {}",
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
