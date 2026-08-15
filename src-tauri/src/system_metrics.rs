use parking_lot::Mutex;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use sysinfo::{Pid, ProcessRefreshKind, RefreshKind, System};
use tauri::{AppHandle, Emitter, Manager};

use crate::config_store::load_projects;
use crate::AppState;

#[derive(Debug, Clone, Serialize)]
pub struct ServerMetric {
    pub server_id: String,
    pub pid: u32,
    pub cpu_usage: f32,
    pub ram_mb: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct SystemMetricsPayload {
    pub managed_cpu_pct: f32,
    pub managed_ram_mb: f64,
    pub active_servers_count: usize,
    pub server_metrics: HashMap<String, ServerMetric>,
}

const RESTART_COOLDOWN: Duration = Duration::from_secs(30);

pub fn start_metrics_poller(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let sys = Arc::new(Mutex::new(System::new_with_specifics(
            RefreshKind::new().with_processes(ProcessRefreshKind::everything()),
        )));
        let last_restart: Arc<Mutex<HashMap<String, Instant>>> =
            Arc::new(Mutex::new(HashMap::new()));
        let mut had_servers_last_tick = false;

        loop {
            tokio::time::sleep(Duration::from_secs(2)).await;

            let Some(state) = app.try_state::<Mutex<AppState>>() else {
                continue;
            };
            let active_pids = state.lock().process_manager.get_active_pids();

            // Évite de rafraîchir toute la table des processus toutes les 2s
            // quand aucun serveur n'est actif (et n'émet qu'une fois des zéros).
            if active_pids.is_empty() && !had_servers_last_tick {
                continue;
            }
            had_servers_last_tick = !active_pids.is_empty();

            let mut to_restart: Vec<(String, u32)> = Vec::new();

            let metrics = {
                let mut s = sys.lock();
                s.refresh_processes_specifics(ProcessRefreshKind::everything());

                let mut server_metrics = HashMap::new();
                let mut total_cpu: f32 = 0.0;
                let mut total_ram_bytes: u64 = 0;

                for (server_id, root_pid) in &active_pids {
                    let mut srv_cpu: f32 = 0.0;
                    let mut srv_ram: u64 = 0;

                    // Somme les métriques du process racine et de ses enfants
                    for (pid, process) in s.processes() {
                        let pid_u32 = pid.as_u32();
                        if pid_u32 == *root_pid || is_descendant(s.processes(), pid_u32, *root_pid) {
                            srv_cpu += process.cpu_usage();
                            srv_ram += process.memory();
                        }
                    }

                    total_cpu += srv_cpu;
                    total_ram_bytes += srv_ram;

                    server_metrics.insert(
                        server_id.clone(),
                        ServerMetric {
                            server_id: server_id.clone(),
                            pid: *root_pid,
                            cpu_usage: srv_cpu,
                            ram_mb: (srv_ram as f64) / (1024.0 * 1024.0),
                        },
                    );
                }

                SystemMetricsPayload {
                    managed_cpu_pct: total_cpu,
                    managed_ram_mb: (total_ram_bytes as f64) / (1024.0 * 1024.0),
                    active_servers_count: active_pids.len(),
                    server_metrics,
                }
            };

            // Auto-Guard RAM : redémarre un serveur qui dépasse sa limite
            // configurée, avec un cooldown anti crash-loop.
            if !active_pids.is_empty() {
                let projects = load_projects();
                let mut restarts = last_restart.lock();
                for prj in &projects {
                    for srv in &prj.servers {
                        if let Some(limit) = srv.ram_limit {
                            if let Some(m) = metrics.server_metrics.get(&srv.id) {
                                if m.ram_mb > limit as f64 {
                                    let now = Instant::now();
                                    let cooldown_ok = restarts
                                        .get(&srv.id)
                                        .map_or(true, |t| now.duration_since(*t) >= RESTART_COOLDOWN);
                                    if cooldown_ok {
                                        restarts.insert(srv.id.clone(), now);
                                        to_restart.push((srv.id.clone(), m.pid));
                                    }
                                }
                            }
                        }
                    }
                }
            }

            let _ = app.emit("system-metrics", metrics);

            for (server_id, pid) in to_restart {
                eprintln!(
                    "Portly Auto-Guard: le serveur {} (PID {}) dépasse sa limite RAM — redémarrage.",
                    server_id, pid
                );
                restart_server(&app, &server_id).await;
            }
        }
    });
}

async fn restart_server(app: &AppHandle, server_id: &str) {
    let projects = load_projects();
    let found = projects.iter().find_map(|prj| {
        prj.servers
            .iter()
            .find(|srv| srv.id == server_id)
            .map(|srv| (prj.root.clone(), srv.clone()))
    });

    let Some((root, srv)) = found else { return };

    {
        let state = app.state::<Mutex<AppState>>();
        let _ = state.lock().process_manager.stop_server(server_id);
    }

    // Laisse le taskkill /T se propager avant de relancer
    tokio::time::sleep(Duration::from_millis(1200)).await;

    let state = app.state::<Mutex<AppState>>();
    let result = state.lock().process_manager.start_server(
        app.clone(),
        server_id.to_string(),
        root,
        srv.command,
        srv.env,
    );
    if let Err(e) = result {
        eprintln!("Portly Auto-Guard: échec du redémarrage de {}: {}", server_id, e);
    }
}

fn is_descendant(processes: &HashMap<Pid, sysinfo::Process>, target_pid: u32, root_pid: u32) -> bool {
    let mut current = target_pid;
    let mut depth = 0;
    while depth < 32 {
        if let Some(proc) = processes.get(&Pid::from(current as usize)) {
            if let Some(parent) = proc.parent() {
                let parent_u32 = parent.as_u32();
                if parent_u32 == root_pid {
                    return true;
                }
                if parent_u32 == current {
                    break;
                }
                current = parent_u32;
                depth += 1;
            } else {
                break;
            }
        } else {
            break;
        }
    }
    false
}
