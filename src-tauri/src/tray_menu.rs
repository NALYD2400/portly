use std::collections::HashSet;
use std::sync::atomic::{AtomicU8, Ordering};
use std::time::{Duration, Instant};

use parking_lot::Mutex;
use serde::Serialize;
use tauri::menu::{MenuBuilder, MenuItem, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{
    AppHandle, Emitter, Listener, Manager, PhysicalPosition, WebviewUrl, WebviewWindowBuilder,
};

use crate::config_store::{load_projects, ProjectConfig};
use crate::{shutdown_all_managed_processes, AppState};

const IDLE: u8 = 0;
const STARTING: u8 = 1;
const STOPPING: u8 = 2;
const QUITTING: u8 = 3;

struct TrayMenuState {
    status: MenuItem<tauri::Wry>,
    start: MenuItem<tauri::Wry>,
    stop: MenuItem<tauri::Wry>,
    quit: MenuItem<tauri::Wry>,
    activity: AtomicU8,
    rendered: Mutex<Option<MenuModel>>,
    last_double_click: Mutex<Option<Instant>>,
}

#[derive(Debug, PartialEq, Eq)]
struct MenuModel {
    status: String,
    start_label: String,
    stop_label: String,
    can_start: bool,
    can_stop: bool,
    can_quit: bool,
}

fn server_count(count: usize) -> String {
    format!("{count} serveur{}", if count == 1 { "" } else { "s" })
}

fn menu_model(configured: &HashSet<String>, running: &HashSet<String>, activity: u8) -> MenuModel {
    let stopped = configured.difference(running).count();
    let status = match activity {
        STARTING => "Démarrage en cours…".to_string(),
        STOPPING => "Arrêt en cours…".to_string(),
        QUITTING => "Fermeture de Sprint…".to_string(),
        _ if running.is_empty() => "Aucun serveur en cours".to_string(),
        _ => format!("{} en cours", server_count(running.len())),
    };
    MenuModel {
        status,
        start_label: if stopped == 0 {
            "Démarrer les serveurs".to_string()
        } else {
            format!("Démarrer {}", server_count(stopped))
        },
        stop_label: if running.is_empty() {
            "Arrêter les serveurs".to_string()
        } else {
            format!("Arrêter {}", server_count(running.len()))
        },
        can_start: activity == IDLE && stopped > 0,
        can_stop: activity == IDLE && !running.is_empty(),
        can_quit: activity == IDLE,
    }
}

fn show_window(app: &AppHandle) {
    if let Some(panel) = app.get_webview_window("tray") {
        let _ = panel.hide();
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn refresh(app: &AppHandle) {
    let Some(menu) = app.try_state::<TrayMenuState>() else {
        return;
    };
    // Serialize snapshots as well as rendering so an older refresh cannot
    // overwrite a newer server count after concurrent status events.
    let mut rendered = menu.rendered.lock();
    let configured = load_projects()
        .into_iter()
        .flat_map(|project| project.servers.into_iter().map(|server| server.id))
        .collect();
    let running = app
        .state::<Mutex<AppState>>()
        .lock()
        .process_manager
        .get_active_pids()
        .into_keys()
        .collect();
    let model = menu_model(&configured, &running, menu.activity.load(Ordering::SeqCst));
    if rendered.as_ref() == Some(&model) {
        return;
    }
    let _ = menu.status.set_text(&model.status);
    let _ = menu.start.set_text(&model.start_label);
    let _ = menu.stop.set_text(&model.stop_label);
    let _ = menu.start.set_enabled(model.can_start);
    let _ = menu.stop.set_enabled(model.can_stop);
    let _ = menu.quit.set_enabled(model.can_quit);
    if let Some(tray) = app.tray_by_id("main_tray") {
        let _ = tray.set_tooltip(Some(format!("Sprint · {}", model.status)));
    }
    *rendered = Some(model);
    let _ = app.emit("tray-state-changed", ());
}

pub fn request_refresh(app: &AppHandle) {
    let app = app.clone();
    // A status event may be emitted while the process manager is locked.
    // Queue the refresh instead of reading that state inside the event callback.
    tauri::async_runtime::spawn_blocking(move || refresh(&app));
}

fn run_action(app: &AppHandle, activity: u8, server_id: Option<String>) -> Result<(), String> {
    let menu = app.state::<TrayMenuState>();
    if menu
        .activity
        .compare_exchange(IDLE, activity, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err("Une action est déjà en cours.".to_string());
    }
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        refresh(&app);
        if activity == QUITTING {
            shutdown_all_managed_processes(&app);
            app.exit(0);
            return;
        }
        let mut errors = Vec::new();
        if activity == STARTING {
            for project in load_projects() {
                for server in project.servers {
                    if server_id.as_ref().is_some_and(|id| id != &server.id) {
                        continue;
                    }
                    let state = app.state::<Mutex<AppState>>();
                    let guard = state.lock();
                    if guard.process_manager.is_running(&server.id) {
                        continue;
                    }
                    if let Err(error) = guard.process_manager.start_server(
                        app.clone(),
                        server.id,
                        project.root.clone(),
                        server.command,
                        server.env,
                    ) {
                        errors.push(format!("{} : {error}", server.name));
                    }
                }
            }
        } else {
            // Include managed servers whose project was removed while running.
            let ids: Vec<_> = app
                .state::<Mutex<AppState>>()
                .lock()
                .process_manager
                .get_active_pids()
                .into_keys()
                .collect();
            for id in ids {
                if server_id.as_ref().is_some_and(|target| target != &id) {
                    continue;
                }
                let state = app.state::<Mutex<AppState>>();
                let result = state.lock().process_manager.stop_server(&app, &id);
                if let Err(error) = result {
                    errors.push(error);
                }
            }
        }
        app.state::<TrayMenuState>()
            .activity
            .store(IDLE, Ordering::SeqCst);
        refresh(&app);
        if !errors.is_empty() {
            show_window(&app);
            let _ = app.emit("tray-action-error", errors.join("\n"));
        }
    });
    Ok(())
}

#[derive(Serialize)]
pub struct TraySnapshot {
    projects: Vec<ProjectConfig>,
    activity: u8,
    running_count: usize,
}

#[tauri::command]
pub async fn get_tray_state_cmd(app: AppHandle) -> Result<TraySnapshot, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let running = app
            .state::<Mutex<AppState>>()
            .lock()
            .process_manager
            .get_active_pids();
        let mut projects = load_projects();
        for project in &mut projects {
            for server in &mut project.servers {
                if running.contains_key(&server.id) {
                    server.state = "running".to_string();
                }
            }
        }
        TraySnapshot {
            projects,
            running_count: running.len(),
            activity: app.state::<TrayMenuState>().activity.load(Ordering::SeqCst),
        }
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn tray_action_cmd(
    app: AppHandle,
    action: String,
    server_id: Option<String>,
    tab: Option<String>,
) -> Result<(), String> {
    match action.as_str() {
        "open" => {
            show_window(&app);
            if let Some(tab) = tab {
                if !["dashboard", "projects", "terminal", "settings"].contains(&tab.as_str()) {
                    return Err("Page inconnue.".to_string());
                }
                app.emit(
                    "tray-navigate",
                    serde_json::json!({ "tab": tab, "serverId": server_id }),
                )
                .map_err(|error| error.to_string())?;
            }
            Ok(())
        }
        "start-all" => run_action(&app, STARTING, None),
        "stop-all" => run_action(&app, STOPPING, None),
        "quit" => run_action(&app, QUITTING, None),
        "toggle-server" => {
            let id = server_id.ok_or("Serveur manquant.")?;
            if !load_projects()
                .iter()
                .any(|project| project.servers.iter().any(|server| server.id == id))
            {
                return Err("Ce serveur n’existe plus.".to_string());
            }
            let running = app
                .state::<Mutex<AppState>>()
                .lock()
                .process_manager
                .is_running(&id);
            run_action(&app, if running { STOPPING } else { STARTING }, Some(id))
        }
        _ => Err("Action inconnue.".to_string()),
    }
}

fn panel_position(cursor: (f64, f64), size: (f64, f64), area: (f64, f64, f64, f64)) -> (i32, i32) {
    let (left, top, width, height) = area;
    let x =
        (cursor.0 - size.0 + 16.0).clamp(left + 8.0, (left + width - size.0 - 8.0).max(left + 8.0));
    let y =
        (cursor.1 - size.1 - 12.0).clamp(top + 8.0, (top + height - size.1 - 8.0).max(top + 8.0));
    (x.round() as i32, y.round() as i32)
}

fn show_panel(app: &AppHandle, cursor: PhysicalPosition<f64>) {
    let Some(panel) = app.get_webview_window("tray") else {
        show_window(app);
        return;
    };
    if let Ok(monitors) = panel.available_monitors() {
        let monitor = monitors.into_iter().find(|monitor| {
            let p = monitor.position();
            let s = monitor.size();
            cursor.x >= p.x as f64
                && cursor.x < p.x as f64 + s.width as f64
                && cursor.y >= p.y as f64
                && cursor.y < p.y as f64 + s.height as f64
        });
        if let Some(monitor) = monitor {
            let area = monitor.work_area();
            let scale = monitor.scale_factor();
            let width = 360.0_f64
                .min(area.size.width as f64 / scale - 16.0)
                .max(1.0);
            let height = 540.0_f64
                .min(area.size.height as f64 / scale - 16.0)
                .max(1.0);
            let _ = panel.set_size(tauri::LogicalSize::new(width, height));
            let (x, y) = panel_position(
                (cursor.x, cursor.y),
                (width * scale, height * scale),
                (
                    area.position.x as f64,
                    area.position.y as f64,
                    area.size.width as f64,
                    area.size.height as f64,
                ),
            );
            let _ = panel.set_position(PhysicalPosition::new(x, y));
        }
    }
    let _ = panel.show();
    let _ = panel.set_focus();
    let _ = panel.emit("tray-panel-opened", ());
}

pub fn setup(app: &tauri::App) -> tauri::Result<()> {
    let show = MenuItemBuilder::with_id("tray_show", "Ouvrir Sprint").build(app)?;
    let settings = MenuItemBuilder::with_id("tray_settings", "Paramètres").build(app)?;
    let status = MenuItemBuilder::with_id("tray_status", "Aucun serveur en cours")
        .enabled(false)
        .build(app)?;
    let start = MenuItemBuilder::with_id("tray_start", "Démarrer les serveurs")
        .enabled(false)
        .build(app)?;
    let stop = MenuItemBuilder::with_id("tray_stop", "Arrêter les serveurs")
        .enabled(false)
        .build(app)?;
    let quit = MenuItemBuilder::with_id("tray_quit", "Quitter Sprint").build(app)?;
    let menu = MenuBuilder::new(app)
        .items(&[&show, &settings])
        .separator()
        .items(&[&status, &start, &stop])
        .separator()
        .item(&quit)
        .build()?;
    app.manage(TrayMenuState {
        status,
        start,
        stop,
        quit,
        activity: AtomicU8::new(IDLE),
        rendered: Mutex::new(None),
        last_double_click: Mutex::new(None),
    });
    // A dedicated webview provides the same theme, spacing and server controls as Sprint.
    // Keep the native menu as a fallback if Windows cannot create the panel.
    let custom_panel =
        WebviewWindowBuilder::new(app, "tray", WebviewUrl::App("index.html?tray=1".into()))
            .title("Sprint · Accès rapide")
            .inner_size(360.0, 540.0)
            .decorations(false)
            .resizable(false)
            .visible(false)
            .focused(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .shadow(true)
            .build();
    if let Ok(panel) = &custom_panel {
        let handle = panel.clone();
        panel.on_window_event(move |event| {
            if matches!(event, tauri::WindowEvent::Focused(false)) {
                let _ = handle.hide();
            }
        });
    }
    let mut tray = TrayIconBuilder::with_id("main_tray")
        .tooltip("Sprint")
        .show_menu_on_left_click(false);
    if custom_panel.is_err() {
        tray = tray.menu(&menu);
    }
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.on_menu_event(|app, event| match event.id.as_ref() {
        "tray_show" => show_window(app),
        "tray_settings" => {
            show_window(app);
            let _ = app.emit("tray-navigate", "settings");
        }
        "tray_start" => {
            let _ = run_action(app, STARTING, None);
        }
        "tray_stop" => {
            let _ = run_action(app, STOPPING, None);
        }
        "tray_quit" => {
            let _ = run_action(app, QUITTING, None);
        }
        _ => {}
    })
    .on_tray_icon_event(|tray, event| {
        if let TrayIconEvent::Click {
            position,
            button,
            button_state: MouseButtonState::Up,
            ..
        } = event
        {
            let app = tray.app_handle();
            if app
                .state::<TrayMenuState>()
                .last_double_click
                .lock()
                .is_some_and(|time| time.elapsed() < Duration::from_millis(350))
            {
                return;
            }
            if app.get_webview_window("tray").is_some() {
                show_panel(app, position);
            } else if button == MouseButton::Left {
                show_window(app);
            }
        } else if matches!(
            event,
            TrayIconEvent::DoubleClick {
                button: MouseButton::Left,
                ..
            }
        ) {
            *tray
                .app_handle()
                .state::<TrayMenuState>()
                .last_double_click
                .lock() = Some(Instant::now());
            show_window(tray.app_handle());
        }
    })
    .build(app)?;
    let handle = app.handle().clone();
    app.listen("server-status-changed", move |_| request_refresh(&handle));
    request_refresh(app.handle());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ids(values: &[&str]) -> HashSet<String> {
        values.iter().map(|id| id.to_string()).collect()
    }

    #[test]
    fn idle_actions_follow_configured_and_running_servers() {
        let empty = menu_model(&ids(&[]), &ids(&[]), IDLE);
        assert!(!empty.can_start && !empty.can_stop && empty.can_quit);
        let stopped = menu_model(&ids(&["a", "b"]), &ids(&[]), IDLE);
        assert!(stopped.can_start && !stopped.can_stop);
        assert_eq!(stopped.start_label, "Démarrer 2 serveurs");
        let mixed = menu_model(&ids(&["a", "b"]), &ids(&["a"]), IDLE);
        assert!(mixed.can_start && mixed.can_stop);
        assert_eq!(mixed.status, "1 serveur en cours");
        assert_eq!(mixed.start_label, "Démarrer 1 serveur");
        let running = menu_model(&ids(&["a", "b"]), &ids(&["a", "b"]), IDLE);
        assert!(!running.can_start && running.can_stop);
        assert_eq!(running.stop_label, "Arrêter 2 serveurs");
    }

    #[test]
    fn removed_project_does_not_hide_a_managed_process() {
        let model = menu_model(&ids(&[]), &ids(&["removed"]), IDLE);
        assert!(!model.can_start && model.can_stop);
        assert_eq!(model.stop_label, "Arrêter 1 serveur");
    }

    #[test]
    fn actions_are_disabled_while_a_batch_is_in_progress() {
        for activity in [STARTING, STOPPING, QUITTING] {
            let model = menu_model(&ids(&["a", "b"]), &ids(&["a"]), activity);
            assert!(!model.can_start && !model.can_stop && !model.can_quit);
        }
    }

    #[test]
    fn panel_stays_inside_the_work_area_on_multiple_monitors() {
        assert_eq!(
            panel_position((1900.0, 1060.0), (360.0, 500.0), (0.0, 0.0, 1920.0, 1040.0)),
            (1552, 532)
        );
        assert_eq!(
            panel_position(
                (-1900.0, 25.0),
                (540.0, 750.0),
                (-1920.0, 0.0, 1920.0, 1040.0)
            ),
            (-1912, 8)
        );
        assert_eq!(
            panel_position((15.0, 25.0), (360.0, 500.0), (0.0, 0.0, 1920.0, 1040.0)),
            (8, 8)
        );
    }
}
