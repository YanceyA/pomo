use tauri::Manager;

mod database;
pub mod timer;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            timer::start_timer,
            timer::pause_timer,
            timer::resume_timer,
            timer::cancel_timer,
            timer::get_timer_state,
        ])
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data directory");
            let db_path = app_data_dir.join("pomo.db");
            database::initialize(&db_path)?;
            app.manage(timer::AppState::new(db_path));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use tauri::test::{mock_builder, noop_assets};

    #[test]
    fn tauri_app_builds() {
        // Verify the Tauri app can be built using Tauri's mock runtime.
        // This validates plugin registration, command handlers, and capability
        // config without requiring the real WebView2 runtime.
        let _app = mock_builder()
            .plugin(tauri_plugin_opener::init())
            .plugin(tauri_plugin_sql::Builder::default().build())
            .invoke_handler(tauri::generate_handler![
                crate::timer::start_timer,
                crate::timer::pause_timer,
                crate::timer::resume_timer,
                crate::timer::cancel_timer,
                crate::timer::get_timer_state,
            ])
            .build(tauri::test::mock_context(noop_assets()))
            .expect("failed to build mock Tauri app");
    }
}
