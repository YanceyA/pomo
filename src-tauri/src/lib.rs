#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use tauri::test::{mock_builder, noop_assets};

    #[test]
    fn tauri_app_builds() {
        // Verify the Tauri app can be built using Tauri's mock runtime.
        // This validates plugin registration and capability config without
        // requiring the real WebView2 runtime.
        let _app = mock_builder()
            .plugin(tauri_plugin_opener::init())
            .build(tauri::test::mock_context(noop_assets()))
            .expect("failed to build mock Tauri app");
    }
}
