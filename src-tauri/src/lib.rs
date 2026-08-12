mod config_store;
mod port_inspector;
mod process_manager;
mod project_scanner;
mod system_metrics;

use config_store::{load_projects, save_projects, ProjectConfig};
use port_inspector::{get_active_ports, kill_pid, PortEntry};
use process_manager::ProcessManager;
use project_scanner::{detect_stack, get_git_branch, DetectedStack};
use std::collections::HashMap;
use std::fs;
use std::os::windows::process::CommandExt;
use std::path::Path;
use std::sync::Mutex;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, State};

const CREATE_NO_WINDOW: u32 = 0x08000000;

pub struct AppState {
    pub process_manager: ProcessManager,
}

#[tauri::command]
fn hide_window_cmd(window: tauri::Window) {
    let _ = window.hide();
}

#[tauri::command]
fn exit_app(app: AppHandle, state: State<'_, Mutex<AppState>>) {
    let process_mgr = &state.lock().unwrap().process_manager;
    process_mgr.stop_all_servers();
    app.exit(0);
}

#[tauri::command]
fn get_projects_cmd() -> Vec<ProjectConfig> {
    let mut projects = load_projects();
    for prj in &mut projects {
        prj.branch = get_git_branch(&prj.root);
        if prj.framework.is_none() {
            let stack = detect_stack(&prj.root);
            prj.framework = Some(stack.framework);
        }
    }
    projects
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
    let process_mgr = &state.lock().unwrap().process_manager;
    process_mgr.start_server(
        app,
        server_id,
        cwd,
        command,
        env.unwrap_or_default(),
    )
}

#[tauri::command]
fn stop_server_cmd(
    state: State<'_, Mutex<AppState>>,
    server_id: String,
) -> Result<(), String> {
    let process_mgr = &state.lock().unwrap().process_manager;
    process_mgr.stop_server(&server_id)
}

#[tauri::command]
fn get_ports_cmd() -> Vec<PortEntry> {
    get_active_ports()
}

#[tauri::command]
fn kill_port_cmd(pid: u32) -> Result<(), String> {
    kill_pid(pid)
}

#[tauri::command]
fn open_vscode(path: String) -> Result<(), String> {
    std::process::Command::new("code")
        .arg(&path)
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| e.to_string())?;
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
    open::that(url).map_err(|e| e.to_string())
}

#[tauri::command]
async fn ping_port_cmd(port: u16) -> Result<bool, String> {
    use std::net::TcpStream;
    let addr = format!("127.0.0.1:{}", port);
    if let Ok(std_addr) = addr.parse::<std::net::SocketAddr>() {
        if TcpStream::connect_timeout(&std_addr, std::time::Duration::from_millis(500)).is_ok() {
            return Ok(true);
        }
    }
    Ok(false)
}

#[tauri::command]
fn read_env_file(project_root: String) -> Result<String, String> {
    let path = Path::new(&project_root).join(".env");
    if path.exists() {
        fs::read_to_string(path).map_err(|e| e.to_string())
    } else {
        Ok(String::new())
    }
}

use tauri_plugin_notification::NotificationExt;
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

#[tauri::command]
fn save_env_file(project_root: String, content: String) -> Result<(), String> {
    let path = Path::new(&project_root).join(".env");
    fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn send_windows_notification(app: AppHandle, title: String, body: String) {
    let _ = app.notification()
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

#[tauri::command]
fn register_global_shortcut_cmd(app: AppHandle, shortcut: String) -> Result<(), String> {
    let _ = app.global_shortcut().unregister_all();
    if shortcut.is_empty() {
        return Ok(());
    }

    let normalized = shortcut
        .replace("Ctrl", "CommandOrControl")
        .replace("ctrl", "CommandOrControl");

    let _ = app.global_shortcut().on_shortcut(normalized.as_str(), move |app_handle, _shortcut, event| {
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
    });
    Ok(())
}

#[tauri::command]
async fn start_localtunnel_cmd(port: u16) -> Result<String, String> {
    let mut cmd = tokio::process::Command::new("cmd.exe");
    cmd.arg("/C").arg(format!("npx -y localtunnel --port {}", port));
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd.stdout(std::process::Stdio::piped());

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(_) => return Ok(format!("https://localtunnel.me?port={}", port)),
    };

    if let Some(stdout) = child.stdout.take() {
        use tokio::io::AsyncBufReadExt;
        let mut reader = tokio::io::BufReader::new(stdout).lines();
        let timeout = tokio::time::sleep(tokio::time::Duration::from_secs(10));
        tokio::pin!(timeout);

        loop {
            tokio::select! {
                line = reader.next_line() => {
                    if let Ok(Some(line_text)) = line {
                        if line_text.contains("your url is:") {
                            let url = line_text.replace("your url is:", "").trim().to_string();
                            return Ok(url);
                        }
                    } else {
                        break;
                    }
                }
                _ = &mut timeout => {
                    break;
                }
            }
        }
    }

    Ok(format!("https://localtunnel.me?port={}", port))
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

            // Build System Tray Menu
            let show_item = MenuItemBuilder::with_id("show", "Ouvrir Portly").build(app)?;
            let start_all_item = MenuItemBuilder::with_id("start_all", "🚀 Lancer Tous les Serveurs").build(app)?;
            let stop_all_item = MenuItemBuilder::with_id("stop_all", "⏹️ Arrêter Tous les Serveurs").build(app)?;
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
                        let process_mgr = &state_lock.lock().unwrap().process_manager;
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
                        let process_mgr = &state_lock.lock().unwrap().process_manager;
                        for prj in projects {
                            for srv in prj.servers {
                                let _ = process_mgr.stop_server(&srv.id);
                            }
                        }
                    }
                    "quit" => {
                        let state_lock = app.state::<Mutex<AppState>>();
                        let process_mgr = &state_lock.lock().unwrap().process_manager;
                        process_mgr.stop_all_servers();
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
