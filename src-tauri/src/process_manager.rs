use serde::Serialize;
use std::collections::HashMap;
use std::os::windows::process::CommandExt;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Child;

const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Serialize)]
pub struct LogPayload {
    pub server_id: String,
    pub line: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct StatusPayload {
    pub server_id: String,
    pub state: String,
    pub pid: Option<u32>,
}

pub struct ProcessManager {
    processes: Arc<Mutex<HashMap<String, u32>>>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn start_server(
        &self,
        app: AppHandle,
        server_id: String,
        cwd: String,
        command: String,
        env: HashMap<String, String>,
    ) -> Result<u32, String> {
        let mut processes = self.processes.lock().unwrap();

        if processes.contains_key(&server_id) {
            return Err("Server is already running".to_string());
        }

        let mut cmd = tokio::process::Command::new("cmd.exe");
        cmd.arg("/C").arg(&command);
        cmd.current_dir(&cwd);
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        for (k, v) in env {
            cmd.env(k, v);
        }

        let mut child: Child = cmd.spawn().map_err(|e| format!("Failed to spawn process: {}", e))?;

        let pid = child.id().ok_or("Failed to get PID")?;
        processes.insert(server_id.clone(), pid);

        let app_handle = app.clone();
        let s_id = server_id.clone();

        // Emit running status
        let _ = app.emit(
            "server-status-changed",
            StatusPayload {
                server_id: s_id.clone(),
                state: "running".to_string(),
                pid: Some(pid),
            },
        );

        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        // Stream stdout
        if let Some(stdout) = stdout {
            let app_out = app_handle.clone();
            let s_out = s_id.clone();
            tauri::async_runtime::spawn(async move {
                let mut reader = BufReader::new(stdout).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    let _ = app_out.emit(
                        "server-log-line",
                        LogPayload {
                            server_id: s_out.clone(),
                            line,
                        },
                    );
                }
            });
        }

        // Stream stderr
        if let Some(stderr) = stderr {
            let app_err = app_handle.clone();
            let s_err = s_id.clone();
            tauri::async_runtime::spawn(async move {
                let mut reader = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    let _ = app_err.emit(
                        "server-log-line",
                        LogPayload {
                            server_id: s_err.clone(),
                            line,
                        },
                    );
                }
            });
        }

        // Monitor child exit
        let processes_ref = self.processes.clone();
        let app_exit = app_handle.clone();
        let s_exit = s_id.clone();
        tauri::async_runtime::spawn(async move {
            let _ = child.wait().await;
            {
                let mut map = processes_ref.lock().unwrap();
                map.remove(&s_exit);
            }
            let _ = app_exit.emit(
                "server-status-changed",
                StatusPayload {
                    server_id: s_exit,
                    state: "stopped".to_string(),
                    pid: None,
                },
            );
        });

        Ok(pid)
    }

    pub fn stop_server(&self, server_id: &str) -> Result<(), String> {
        let pid_opt = {
            let mut processes = self.processes.lock().unwrap();
            processes.remove(server_id)
        };

        if let Some(pid) = pid_opt {
            let mut kill_cmd = std::process::Command::new("taskkill");
            kill_cmd
                .args(["/F", "/T", "/PID", &pid.to_string()])
                .creation_flags(CREATE_NO_WINDOW);
            let _ = kill_cmd.output();
            Ok(())
        } else {
            Err("Server not running".to_string())
        }
    }

    pub fn stop_all_servers(&self) {
        let mut processes = self.processes.lock().unwrap();
        for (_id, pid) in processes.drain() {
            let mut kill_cmd = std::process::Command::new("taskkill");
            kill_cmd
                .args(["/F", "/T", "/PID", &pid.to_string()])
                .creation_flags(CREATE_NO_WINDOW);
            let _ = kill_cmd.output();
        }
    }

    pub fn is_running(&self, server_id: &str) -> bool {
        let processes = self.processes.lock().unwrap();
        processes.contains_key(server_id)
    }

    pub fn get_active_pids(&self) -> HashMap<String, u32> {
        let processes = self.processes.lock().unwrap();
        processes.clone()
    }
}
