use serde::Serialize;
use std::collections::HashMap;
use std::os::windows::process::CommandExt;
use std::process::Command;

const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Serialize)]
pub struct PortEntry {
    pub protocol: String,
    pub local_address: String,
    pub port: u16,
    pub pid: u32,
    pub process_name: String,
}

pub fn get_active_ports() -> Vec<PortEntry> {
    let mut entries = Vec::new();
    let process_map = get_all_process_names();

    let output = Command::new("netstat")
        .args(["-ano", "-p", "tcp"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    if let Ok(out) = output {
        let stdout = String::from_utf8_lossy(&out.stdout);
        for line in stdout.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 5 && parts[3].to_uppercase() == "LISTENING" {
                let local_addr = parts[1];
                let pid_str = parts[4];

                if let Ok(pid) = pid_str.parse::<u32>() {
                    if pid == 0 {
                        continue;
                    }

                    let port = local_addr
                        .rfind(':')
                        .and_then(|idx| local_addr[idx + 1..].parse::<u16>().ok())
                        .unwrap_or(0);

                    if port > 0 {
                        let proc_name = process_map
                            .get(&pid)
                            .cloned()
                            .unwrap_or_else(|| "Unknown".to_string());

                        entries.push(PortEntry {
                            protocol: "TCP".to_string(),
                            local_address: local_addr.to_string(),
                            port,
                            pid,
                            process_name: proc_name,
                        });
                    }
                }
            }
        }
    }

    entries.sort_by_key(|e| e.port);
    entries.dedup_by_key(|e| (e.port, e.pid));
    entries
}

fn get_all_process_names() -> HashMap<u32, String> {
    let mut map = HashMap::new();
    let output = Command::new("tasklist")
        .args(["/FO", "CSV", "/NH"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    if let Ok(out) = output {
        let stdout = String::from_utf8_lossy(&out.stdout);
        for line in stdout.lines() {
            let parts: Vec<&str> = line.split(',').collect();
            if parts.len() >= 2 {
                let name = parts[0].trim_matches('"').to_string();
                if let Ok(pid) = parts[1].trim_matches('"').parse::<u32>() {
                    map.insert(pid, name);
                }
            }
        }
    }
    map
}

pub fn kill_pid(pid: u32) -> Result<(), String> {
    let output = Command::new("taskkill")
        .args(["/F", "/PID", &pid.to_string()])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    match output {
        Ok(out) if out.status.success() => Ok(()),
        Ok(out) => Err(String::from_utf8_lossy(&out.stderr).to_string()),
        Err(e) => Err(e.to_string()),
    }
}
