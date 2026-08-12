use serde::Serialize;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use sysinfo::{Pid, ProcessRefreshKind, System};
use tauri::{AppHandle, Emitter, Manager};
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

pub fn start_metrics_poller(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let sys = Arc::new(Mutex::new(System::new_all()));

        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

            let state_opt = app.try_state::<Mutex<AppState>>();
            if state_opt.is_none() {
                continue;
            }
            let state = state_opt.unwrap();
            let active_pids = {
                if let Ok(guard) = state.lock() {
                    guard.process_manager.get_active_pids()
                } else {
                    HashMap::new()
                }
            };

            let metrics = {
                let mut s = sys.lock().unwrap();
                s.refresh_processes_specifics(ProcessRefreshKind::everything());

                let mut server_metrics = HashMap::new();
                let mut total_cpu: f32 = 0.0;
                let mut total_ram_bytes: u64 = 0;

                for (server_id, root_pid) in &active_pids {
                    let mut srv_cpu: f32 = 0.0;
                    let mut srv_ram: u64 = 0;

                    // Sum metrics for root process and child processes
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

            let _ = app.emit("system-metrics", metrics);
        }
    });
}

fn is_descendant(
    processes: &HashMap<Pid, sysinfo::Process>,
    target_pid: u32,
    root_pid: u32,
) -> bool {
    let mut current = target_pid;
    let mut depth = 0;
    while depth < 10 {
        if let Some(proc) = processes.get(&Pid::from(current as usize)) {
            if let Some(parent) = proc.parent() {
                let parent_u32 = parent.as_u32();
                if parent_u32 == root_pid {
                    return true;
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
