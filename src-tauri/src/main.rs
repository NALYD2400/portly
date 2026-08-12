// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    std::panic::set_hook(Box::new(|info| {
        let msg = format!("Portly Panic Error: {}\n", info);
        let _ = std::fs::write("C:\\Users\\dylan\\Desktop\\portly_crash.log", &msg);
    }));

    portly::run();
}
