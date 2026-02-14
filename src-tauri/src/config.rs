use crate::database;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, Runtime};

/// Application configuration stored in `{app_data_dir}/config.json`.
/// This file lives in the default app data directory so we can always find it,
/// even when the user has moved the database elsewhere.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppConfig {
    /// Custom database path. When `None`, the default location is used.
    pub db_path: Option<String>,
}

/// Read the config file. Returns default config if file doesn't exist or is invalid.
pub fn read_config(app_data_dir: &Path) -> AppConfig {
    let config_path = app_data_dir.join("config.json");
    if !config_path.exists() {
        return AppConfig::default();
    }
    match std::fs::read_to_string(&config_path) {
        Ok(contents) => serde_json::from_str(&contents).unwrap_or_default(),
        Err(_) => AppConfig::default(),
    }
}

/// Write the config file.
fn write_config(app_data_dir: &Path, config: &AppConfig) -> Result<(), String> {
    let config_path = app_data_dir.join("config.json");
    let contents =
        serde_json::to_string_pretty(config).map_err(|e| format!("Failed to serialize config: {e}"))?;
    std::fs::write(&config_path, contents).map_err(|e| format!("Failed to write config: {e}"))
}

/// Resolve the database path from config.
/// Returns the custom path if set and valid, otherwise the default.
pub fn resolve_db_path(app_data_dir: &Path) -> PathBuf {
    let config = read_config(app_data_dir);
    match config.db_path {
        Some(ref custom) if !custom.is_empty() => PathBuf::from(custom),
        _ => app_data_dir.join("pomo.db"),
    }
}

/// Information about the current database configuration.
#[derive(Debug, Clone, Serialize)]
pub struct DbInfo {
    pub path: String,
    pub is_custom: bool,
    pub is_cloud_synced: bool,
    pub journal_mode: String,
    pub default_path: String,
}

/// Get information about the current database location and configuration.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub fn get_db_info<R: Runtime>(app: AppHandle<R>) -> Result<DbInfo, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data directory: {e}"))?;

    let config = read_config(&app_data_dir);
    let default_path = app_data_dir.join("pomo.db");
    let db_path = resolve_db_path(&app_data_dir);
    let is_cloud = database::is_cloud_synced_path(&db_path);

    Ok(DbInfo {
        path: db_path.to_string_lossy().to_string(),
        is_custom: config.db_path.is_some(),
        is_cloud_synced: is_cloud,
        journal_mode: if is_cloud { "DELETE".to_string() } else { "WAL".to_string() },
        default_path: default_path.to_string_lossy().to_string(),
    })
}

/// Change the database path. Copies the current DB to the new directory.
/// The app must be restarted for the change to take effect.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub fn change_db_path<R: Runtime>(app: AppHandle<R>, new_directory: String) -> Result<DbInfo, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data directory: {e}"))?;

    let new_dir = PathBuf::from(&new_directory);
    if !new_dir.exists() {
        return Err("Selected directory does not exist.".to_string());
    }
    if !new_dir.is_dir() {
        return Err("Selected path is not a directory.".to_string());
    }

    let new_db_path = new_dir.join("pomo.db");
    let current_db_path = resolve_db_path(&app_data_dir);

    // Don't copy over the same file
    if current_db_path != new_db_path {
        // Copy current DB to new location (if current DB exists)
        if current_db_path.exists() {
            std::fs::copy(&current_db_path, &new_db_path)
                .map_err(|e| format!("Failed to copy database: {e}"))?;
        }
    }

    // Write config with new path
    let config = AppConfig {
        db_path: Some(new_db_path.to_string_lossy().to_string()),
    };
    write_config(&app_data_dir, &config)?;

    let is_cloud = database::is_cloud_synced_path(&new_db_path);
    Ok(DbInfo {
        path: new_db_path.to_string_lossy().to_string(),
        is_custom: true,
        is_cloud_synced: is_cloud,
        journal_mode: if is_cloud { "DELETE".to_string() } else { "WAL".to_string() },
        default_path: app_data_dir.join("pomo.db").to_string_lossy().to_string(),
    })
}

/// Reset the database path to the default location.
/// Copies the current DB back to the default location if needed.
/// The app must be restarted for the change to take effect.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub fn reset_db_path<R: Runtime>(app: AppHandle<R>) -> Result<DbInfo, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data directory: {e}"))?;

    let default_path = app_data_dir.join("pomo.db");
    let current_db_path = resolve_db_path(&app_data_dir);

    // Copy current DB back to default location if it's different
    if current_db_path != default_path && current_db_path.exists() && !default_path.exists() {
        std::fs::copy(&current_db_path, &default_path)
            .map_err(|e| format!("Failed to copy database to default location: {e}"))?;
    }

    // Write config with no custom path
    let config = AppConfig { db_path: None };
    write_config(&app_data_dir, &config)?;

    let is_cloud = database::is_cloud_synced_path(&default_path);
    Ok(DbInfo {
        path: default_path.to_string_lossy().to_string(),
        is_custom: false,
        is_cloud_synced: is_cloud,
        journal_mode: if is_cloud { "DELETE".to_string() } else { "WAL".to_string() },
        default_path: default_path.to_string_lossy().to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn read_config_returns_default_when_no_file() {
        let dir = std::env::temp_dir().join("pomo_test_config_none");
        let _ = fs::create_dir_all(&dir);
        let config = read_config(&dir);
        assert!(config.db_path.is_none());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn read_config_returns_default_on_invalid_json() {
        let dir = std::env::temp_dir().join("pomo_test_config_invalid");
        let _ = fs::create_dir_all(&dir);
        fs::write(dir.join("config.json"), "not valid json").unwrap();
        let config = read_config(&dir);
        assert!(config.db_path.is_none());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn write_and_read_config_round_trip() {
        let dir = std::env::temp_dir().join("pomo_test_config_roundtrip");
        let _ = fs::create_dir_all(&dir);

        let config = AppConfig {
            db_path: Some(r"C:\Users\user\OneDrive\pomo.db".to_string()),
        };
        write_config(&dir, &config).unwrap();

        let loaded = read_config(&dir);
        assert_eq!(loaded.db_path, Some(r"C:\Users\user\OneDrive\pomo.db".to_string()));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn resolve_db_path_uses_default_when_no_config() {
        let dir = std::env::temp_dir().join("pomo_test_resolve_default");
        let _ = fs::create_dir_all(&dir);
        let path = resolve_db_path(&dir);
        assert_eq!(path, dir.join("pomo.db"));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn resolve_db_path_uses_custom_when_configured() {
        let dir = std::env::temp_dir().join("pomo_test_resolve_custom");
        let _ = fs::create_dir_all(&dir);

        let custom_path = r"D:\Data\pomo.db";
        let config = AppConfig {
            db_path: Some(custom_path.to_string()),
        };
        write_config(&dir, &config).unwrap();

        let path = resolve_db_path(&dir);
        assert_eq!(path, PathBuf::from(custom_path));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn resolve_db_path_uses_default_for_empty_custom() {
        let dir = std::env::temp_dir().join("pomo_test_resolve_empty");
        let _ = fs::create_dir_all(&dir);

        let config = AppConfig {
            db_path: Some(String::new()),
        };
        write_config(&dir, &config).unwrap();

        let path = resolve_db_path(&dir);
        assert_eq!(path, dir.join("pomo.db"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn reset_config_clears_custom_path() {
        let dir = std::env::temp_dir().join("pomo_test_reset");
        let _ = fs::create_dir_all(&dir);

        let config = AppConfig {
            db_path: Some(r"D:\Data\pomo.db".to_string()),
        };
        write_config(&dir, &config).unwrap();

        // Verify custom path is set
        let loaded = read_config(&dir);
        assert!(loaded.db_path.is_some());

        // Reset
        let reset = AppConfig { db_path: None };
        write_config(&dir, &reset).unwrap();

        let after = read_config(&dir);
        assert!(after.db_path.is_none());

        let _ = fs::remove_dir_all(&dir);
    }
}
