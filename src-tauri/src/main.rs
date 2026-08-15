// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let msg = format!("Portly Panic Error: {}\n", info);
        // Journalise dans le dossier de config de l'utilisateur au lieu d'un chemin en dur
        let file = portly::config_store::get_crash_log_file();
        let _ = std::fs::write(file, &msg);
        default_hook(info);
    }));

    portly::run();
}
