use netstat2::{AddressFamilyFlags, ProtocolFlags, ProtocolSocketInfo, TcpState};
use serde::Serialize;
use std::collections::HashMap;
use std::os::windows::process::CommandExt;
use std::process::Command;
use sysinfo::{ProcessRefreshKind, RefreshKind, System};

const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Serialize)]
pub struct PortEntry {
    pub protocol: String,
    pub local_address: String,
    pub port: u16,
    pub pid: u32,
    pub process_name: String,
}

/// Liste les ports TCP en écoute via l'API native Windows (GetExtendedTcpTable),
/// indépendamment de la langue du système (netstat affiche "ÉCOUTE" en français).
pub fn get_active_ports() -> Result<Vec<PortEntry>, String> {
    let process_map = get_all_process_names();

    let af_flags = AddressFamilyFlags::IPV4 | AddressFamilyFlags::IPV6;
    let proto_flags = ProtocolFlags::TCP;
    let sockets_info = netstat2::get_sockets_info(af_flags, proto_flags)
        .map_err(|e| format!("Erreur scan des ports système: {}", e))?;

    let mut entries: Vec<PortEntry> = Vec::new();

    for socket in sockets_info {
        let tcp = match socket.protocol_socket_info {
            ProtocolSocketInfo::Tcp(tcp) => tcp,
            _ => continue,
        };

        if tcp.state != TcpState::Listen {
            continue;
        }

        let pid = socket.associated_pids.first().copied().unwrap_or(0);
        if pid == 0 {
            continue;
        }

        let proc_name = process_map
            .get(&pid)
            .cloned()
            .unwrap_or_else(|| "Unknown".to_string());

        entries.push(PortEntry {
            protocol: "TCP".to_string(),
            local_address: format!("[{}]:{}", tcp.local_addr, tcp.local_port),
            port: tcp.local_port,
            pid,
            process_name: proc_name,
        });
    }

    entries.sort_by_key(|e| e.port);
    entries.dedup_by_key(|e| (e.port, e.pid));
    Ok(entries)
}

/// Associe les PID aux noms de processus via sysinfo (remplace le parsing
/// localisé et fragile de `tasklist /FO CSV`).
fn get_all_process_names() -> HashMap<u32, String> {
    let sys = System::new_with_specifics(
        RefreshKind::new().with_processes(ProcessRefreshKind::everything()),
    );

    sys.processes()
        .iter()
        .map(|(pid, process)| {
            let name = process
                .exe()
                .and_then(|p| p.file_stem())
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_else(|| process.name().to_string());
            (pid.as_u32(), name)
        })
        .collect()
}

/// Tue un process et tout son arbre (/T), en propageant l'erreur.
pub fn kill_pid(pid: u32) -> Result<(), String> {
    let output = Command::new("taskkill")
        .args(["/F", "/T", "/PID", &pid.to_string()])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    match output {
        Ok(out) if out.status.success() => Ok(()),
        Ok(out) => Err(String::from_utf8_lossy(&out.stderr).trim().to_string()),
        Err(e) => Err(e.to_string()),
    }
}
