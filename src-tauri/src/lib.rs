pub mod config_store;
mod port_inspector;
mod process_manager;
mod project_scanner;
mod system_metrics;

use config_store::{load_projects, save_projects, ProjectConfig};
use parking_lot::Mutex;
use port_inspector::{get_active_ports, kill_pid, PortEntry};
use process_manager::ProcessManager;
use project_scanner::{detect_stack, get_git_branch, DetectedStack};
use std::collections::HashMap;
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Domaines autorisés pour le téléchargement des mises à jour.
const UPDATE_HOSTS: &[&str] = &[
    "github.com",
    "api.github.com",
    "objects.githubusercontent.com",
    "release-assets.githubusercontent.com",
];

pub struct AppState {
    pub process_manager: ProcessManager,
}

/// PIDs des tunnels localtunnel actifs, pour les nettoyer à la fermeture.
static TUNNEL_PIDS: Mutex<Vec<u32>> = Mutex::new(Vec::new());

fn stop_all_tunnels() {
    let pids: Vec<u32> = {
        let mut guard = TUNNEL_PIDS.lock();
        std::mem::take(&mut *guard)
    };
    for pid in pids {
        let mut c = std::process::Command::new("taskkill");
        c.args(["/F", "/T", "/PID", &pid.to_string()])
            .creation_flags(CREATE_NO_WINDOW);
        let _ = c.output();
    }
}

fn shutdown_all_managed_processes(app: &AppHandle) {
    let state = app.state::<Mutex<AppState>>();
    state.lock().process_manager.stop_all_servers();
    stop_all_tunnels();
}

#[tauri::command]
fn hide_window_cmd(window: tauri::Window) {
    let _ = window.hide();
}

#[tauri::command]
async fn exit_app(app: AppHandle) -> Result<(), String> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        shutdown_all_managed_processes(&app_handle);
    })
    .await
    .map_err(|e| e.to_string())?;
    app.exit(0);
    Ok(())
}

#[tauri::command]
async fn relaunch_app_cmd(app: AppHandle) -> Result<(), String> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        shutdown_all_managed_processes(&app_handle);
    })
    .await
    .map_err(|e| e.to_string())?;
    app.restart();
}

#[tauri::command]
async fn get_projects_cmd() -> Result<Vec<ProjectConfig>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut projects = load_projects();
        for prj in &mut projects {
            prj.branch = get_git_branch(&prj.root);
            if prj.framework.is_none() {
                let stack = detect_stack(&prj.root);
                prj.framework = Some(stack.framework);
            }
        }
        projects
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn save_projects_cmd(projects: Vec<ProjectConfig>) -> Result<(), String> {
    save_projects(&projects)
}

#[tauri::command]
fn detect_stack_cmd(path: String) -> DetectedStack {
    detect_stack(&path)
}

#[tauri::command]
fn start_server_cmd(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    server_id: String,
    cwd: String,
    command: String,
    env: Option<HashMap<String, String>>,
) -> Result<u32, String> {
    let process_mgr = &state.lock().process_manager;
    process_mgr.start_server(app, server_id, cwd, command, env.unwrap_or_default())
}

#[tauri::command]
async fn stop_server_cmd(app: AppHandle, server_id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<Mutex<AppState>>();
        let result = state.lock().process_manager.stop_server(&server_id);
        result
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn get_ports_cmd() -> Result<Vec<PortEntry>, String> {
    tauri::async_runtime::spawn_blocking(get_active_ports)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn kill_port_cmd(pid: u32) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || kill_pid(pid))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
fn open_vscode(path: String) -> Result<(), String> {
    std::process::Command::new("code")
        .arg(&path)
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| format!("Impossible de lancer VS Code ('code' dans le PATH ?): {}", e))?;
    Ok(())
}

#[tauri::command]
fn open_explorer(path: String) -> Result<(), String> {
    std::process::Command::new("explorer")
        .arg(&path)
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn open_browser(url: String) -> Result<(), String> {
    // N'autorise que les schémes ouvrables inoffensifs
    let lower = url.to_lowercase();
    if !lower.starts_with("http://") && !lower.starts_with("https://") {
        return Err("Seules les URLs http(s) peuvent être ouvertes.".into());
    }
    open::that(url).map_err(|e| e.to_string())
}

fn is_allowed_update_url(url: &str) -> bool {
    match reqwest::Url::parse(url) {
        Ok(parsed) => {
            parsed.scheme() == "https"
                && parsed
                    .host_str()
                    .map_or(false, |host| UPDATE_HOSTS.contains(&host))
        }
        Err(_) => false,
    }
}

#[tauri::command]
async fn download_update_cmd(app: AppHandle, url: String) -> Result<String, String> {
    use tauri::Emitter;
    use tokio::io::AsyncWriteExt;

    if !is_allowed_update_url(&url) {
        return Err("URL de téléchargement refusée : seules les releases GitHub officielles de Portly sont autorisées.".into());
    }

    let client = reqwest::Client::builder()
        .user_agent("Portly-Updater")
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| format!("Erreur initialisation client HTTP: {}", e))?;

    let mut response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Erreur de réseau: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Erreur serveur HTTP {}", response.status()));
    }

    let total_size = response.content_length().unwrap_or(0);

    // Dossier de staging aléatoire : un autre processus ne peut pas prédire
    // ni remplacer le fichier entre le téléchargement et l'exécution.
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let staging_dir = std::env::temp_dir().join(format!("portly_update_{}_{}", std::process::id(), nonce));
    tokio::fs::create_dir_all(&staging_dir)
        .await
        .map_err(|e| format!("Erreur création du dossier temporaire: {}", e))?;
    let installer_path = staging_dir.join("Portly_setup.exe");

    let mut file = tokio::fs::File::create(&installer_path)
        .await
        .map_err(|e| format!("Erreur création fichier: {}", e))?;

    let mut downloaded: u64 = 0;
    while let Some(chunk_result) = response.chunk().await.transpose() {
        let chunk = chunk_result.map_err(|e| format!("Interruption du téléchargement: {}", e))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Erreur d'écriture: {}", e))?;
        downloaded += chunk.len() as u64;

        let pct = if total_size > 0 {
            ((downloaded as f64 / total_size as f64) * 100.0) as u32
        } else {
            50
        };

        #[derive(serde::Serialize, Clone)]
        struct ProgressPayload {
            downloaded: u64,
            total: u64,
            percentage: u32,
        }

        let _ = app.emit(
            "update-progress",
            ProgressPayload {
                downloaded,
                total: total_size,
                percentage: pct,
            },
        );
    }

    file.flush().await.map_err(|e| format!("Erreur finalisation fichier: {}", e))?;

    if total_size > 0 && downloaded < total_size {
        let _ = tokio::fs::remove_file(&installer_path).await;
        return Err(format!(
            "Téléchargement incomplet: {}/{} octets reçus.",
            downloaded, total_size
        ));
    }

    Ok(installer_path.to_string_lossy().to_string())
}

fn clean_path_str(path: &std::path::Path) -> String {
    let s = path.to_string_lossy().to_string();
    if s.starts_with(r"\\?\") {
        s[4..].to_string()
    } else {
        s
    }
}

#[tauri::command]
async fn install_update_and_relaunch_cmd(
    app: AppHandle,
    installer_path: String,
) -> Result<(), String> {
    let path = PathBuf::from(&installer_path);

    // Sécurité : n'exécute qu'un .exe situé dans notre zone de staging du temp
    let temp = std::env::temp_dir();
    let is_in_temp = path
        .parent()
        .map_or(false, |parent| parent.starts_with(&temp));
    let parent_name_ok = path
        .parent()
        .and_then(|p| p.file_name())
        .map_or(false, |n| n.to_string_lossy().starts_with("portly_update_"));
    let is_exe = path
        .extension()
        .map_or(false, |e| e.eq_ignore_ascii_case("exe"));

    if !is_in_temp || !parent_name_ok || !is_exe || !path.is_file() {
        return Err("Installateur invalide ou introuvable.".into());
    }

    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        shutdown_all_managed_processes(&app_handle);
    })
    .await
    .map_err(|e| e.to_string())?;

    let current_exe = std::env::current_exe().unwrap_or_default();
    let installer_clean = clean_path_str(&path);
    let exe_clean = clean_path_str(&current_exe);

    // PowerShell : attend la fermeture, exécute l'installateur NSIS silencieux
    // (avec relance UAC explicite si nécessaire), nettoie puis redémarre Portly.
    let ps_script = format!(
        "Start-Sleep -Seconds 2; $inst = '{}'; $exe = '{}'; try {{ $p = Start-Process -FilePath $inst -ArgumentList '/S' -PassThru -ErrorAction Stop; $p.WaitForExit() }} catch {{ Start-Process -FilePath $inst -ArgumentList '/S' -Verb RunAs -Wait }}; Remove-Item -LiteralPath (Split-Path $inst) -Recurse -Force -ErrorAction SilentlyContinue; if (Test-Path $exe) {{ Start-Process -FilePath $exe }}",
        installer_clean.replace("'", "''"),
        exe_clean.replace("'", "''")
    );

    std::process::Command::new("powershell")
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &ps_script])
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| format!("Impossible d'exécuter la mise à jour: {}", e))?;

    app.exit(0);
    Ok(())
}

#[tauri::command]
async fn ping_port_cmd(port: u16) -> Result<bool, String> {
    let addr = format!("127.0.0.1:{}", port);
    match tokio::time::timeout(
        std::time::Duration::from_millis(500),
        tokio::net::TcpStream::connect(&addr),
    )
    .await
    {
        Ok(Ok(_)) => Ok(true),
        _ => Ok(false),
    }
}

#[tauri::command]
async fn read_env_file(project_root: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = std::path::Path::new(&project_root).join(".env");
        if path.exists() {
            std::fs::read_to_string(path).map_err(|e| e.to_string())
        } else {
            Ok(String::new())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn save_env_file(project_root: String, content: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = std::path::Path::new(&project_root).join(".env");
        config_store::atomic_write(&path, &content)
    })
    .await
    .map_err(|e| e.to_string())?
}

use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_notification::NotificationExt;

#[tauri::command]
fn send_windows_notification(app: AppHandle, title: String, body: String) {
    let _ = app
        .notification()
        .builder()
        .title(title)
        .body(body)
        .show();
}

#[tauri::command]
fn set_autostart_cmd(app: AppHandle, enable: bool) -> Result<(), String> {
    if enable {
        app.autolaunch().enable().map_err(|e| e.to_string())
    } else {
        app.autolaunch().disable().map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn is_autostart_cmd(app: AppHandle) -> Result<bool, String> {
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

fn register_shortcut_internal(app: &AppHandle, shortcut: &str) -> Result<(), String> {
    let _ = app.global_shortcut().unregister_all();
    if shortcut.is_empty() {
        return Ok(());
    }

    let normalized = shortcut
        .replace("Control", "CommandOrControl")
        .replace("Ctrl", "CommandOrControl")
        .replace("ctrl", "CommandOrControl")
        .replace("Cmd", "Super")
        .replace("Meta", "Super");

    normalized
        .parse::<Shortcut>()
        .map_err(|_| format!("Raccourci clavier invalide : « {} »", shortcut))?;

    app.global_shortcut()
        .on_shortcut(normalized.as_str(), move |app_handle, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                if let Some(window) = app_handle.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.unminimize();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .map_err(|e| format!("Impossible d'enregistrer le raccourci (déjà utilisé ?): {}", e))?;

    Ok(())
}

#[tauri::command]
fn register_global_shortcut_cmd(app: AppHandle, shortcut: String) -> Result<(), String> {
    register_shortcut_internal(&app, &shortcut)?;
    config_store::save_saved_shortcut(&shortcut)
}

#[tauri::command]
async fn start_localtunnel_cmd(port: u16) -> Result<String, String> {
    let mut cmd = tokio::process::Command::new("cmd.exe");
    cmd.arg("/C").arg(format!("npx -y localtunnel --port {}", port));
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd.stdout(std::process::Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Impossible de lancer npx (Node.js est-il installé ?): {}", e))?;

    let pid = child.id().unwrap_or(0);
    if pid > 0 {
        TUNNEL_PIDS.lock().push(pid);
    }

    if let Some(stdout) = child.stdout.take() {
        use tokio::io::{AsyncBufReadExt, BufReader};
        let mut reader = BufReader::new(stdout).lines();
        let timeout = tokio::time::sleep(tokio::time::Duration::from_secs(20));
        tokio::pin!(timeout);

        loop {
            tokio::select! {
                line = reader.next_line() => {
                    match line {
                        Ok(Some(line_text)) => {
                            if line_text.contains("your url is:") {
                                let url = line_text.replace("your url is:", "").trim().to_string();
                                if url.starts_with("https://") {
                                    return Ok(url);
                                }
                            }
                        }
                        _ => break,
                    }
                }
                _ = &mut timeout => break,
            }
        }
    }

    // Échec ou délai dépassé : on nettoie le process fantôme au lieu de
    // renvoyer une URL fictive.
    let _ = child.start_kill();
    if pid > 0 {
        TUNNEL_PIDS.lock().retain(|&p| p != pid);
    }
    Err("localtunnel n'a pas renvoyé d'URL (délai 20s dépassé). Vérifiez que npx et Node.js sont installés.".into())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::AppleScript,
            Some(vec!["--autostart"]),
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(Mutex::new(AppState {
            process_manager: ProcessManager::new(),
        }))
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
            system_metrics::start_metrics_poller(app.handle().clone());

            // Enregistre le raccourci global sauvegardé au démarrage
            let initial_shortcut = config_store::load_saved_shortcut();
            if let Err(e) = register_shortcut_internal(app.handle(), &initial_shortcut) {
                eprintln!("Portly: {}", e);
            }

            // Menu du tray système
            let show_item = MenuItemBuilder::with_id("show", "Ouvrir Portly").build(app)?;
            let start_all_item =
                MenuItemBuilder::with_id("start_all", "🚀 Lancer Tous les Serveurs").build(app)?;
            let stop_all_item =
                MenuItemBuilder::with_id("stop_all", "⏹️ Arrêter Tous les Serveurs").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Quitter Portly").build(app)?;

            let menu = MenuBuilder::new(app)
                .items(&[&show_item, &start_all_item, &stop_all_item, &quit_item])
                .build()?;

            let mut tray_builder = TrayIconBuilder::with_id("main_tray")
                .tooltip("Portly - Gestionnaire de Serveurs")
                .menu(&menu)
                .show_menu_on_left_click(false);

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            let _ = tray_builder
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    "start_all" => {
                        let projects = load_projects();
                        let state_lock = app.state::<Mutex<AppState>>();
                        let process_mgr = &state_lock.lock().process_manager;
                        for prj in projects {
                            for srv in prj.servers {
                                let _ = process_mgr.start_server(
                                    app.clone(),
                                    srv.id,
                                    prj.root.clone(),
                                    srv.command,
                                    srv.env.clone(),
                                );
                            }
                        }
                    }
                    "stop_all" => {
                        let projects = load_projects();
                        let state_lock = app.state::<Mutex<AppState>>();
                        let process_mgr = &state_lock.lock().process_manager;
                        for prj in projects {
                            for srv in prj.servers {
                                let _ = process_mgr.stop_server(&srv.id);
                            }
                        }
                    }
                    "quit" => {
                        shutdown_all_managed_processes(app);
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app);

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            hide_window_cmd,
            exit_app,
            relaunch_app_cmd,
            get_projects_cmd,
            save_projects_cmd,
            detect_stack_cmd,
            start_server_cmd,
            stop_server_cmd,
            get_ports_cmd,
            kill_port_cmd,
            open_vscode,
            open_explorer,
            open_browser,
            read_env_file,
            save_env_file,
            send_windows_notification,
            start_localtunnel_cmd,
            ping_port_cmd,
            set_autostart_cmd,
            is_autostart_cmd,
            register_global_shortcut_cmd,
            download_update_cmd,
            install_update_and_relaunch_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
