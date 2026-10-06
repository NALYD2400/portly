fn main() {
    // Regenerate native icon resources whenever the branding assets change.
    println!("cargo:rerun-if-changed=icons");
    tauri_build::build();
}
