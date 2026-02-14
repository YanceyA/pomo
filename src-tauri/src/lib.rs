use tauri::Manager;

mod database;
pub mod reports;
pub mod tasks;
pub mod timer;
pub mod audio;

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
            tasks::create_task,
            tasks::update_task,
            tasks::delete_task,
            tasks::complete_task,
            tasks::abandon_task,
            tasks::reopen_task,
            tasks::get_tasks_by_date,
            tasks::clone_task,
            tasks::reorder_tasks,
            tasks::link_tasks_to_interval,
            tasks::get_task_interval_counts,
            tasks::copy_task_to_day,
            tasks::get_days_with_tasks,
            tasks::get_task_origin_dates,
            reports::get_daily_summary,
            reports::get_weekly_summary,
            reports::get_monthly_summary,
            audio::play_alarm,
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
        let _app = mock_builder()
            .plugin(tauri_plugin_opener::init())
            .plugin(tauri_plugin_sql::Builder::default().build())
            .invoke_handler(tauri::generate_handler![
                crate::timer::start_timer,
                crate::timer::pause_timer,
                crate::timer::resume_timer,
                crate::timer::cancel_timer,
                crate::timer::get_timer_state,
                crate::tasks::create_task,
                crate::tasks::update_task,
                crate::tasks::delete_task,
                crate::tasks::complete_task,
                crate::tasks::abandon_task,
                crate::tasks::reopen_task,
                crate::tasks::get_tasks_by_date,
                crate::tasks::clone_task,
                crate::tasks::reorder_tasks,
                crate::tasks::link_tasks_to_interval,
                crate::tasks::get_task_interval_counts,
                crate::tasks::copy_task_to_day,
                crate::tasks::get_days_with_tasks,
                crate::tasks::get_task_origin_dates,
                crate::reports::get_daily_summary,
                crate::reports::get_weekly_summary,
                crate::reports::get_monthly_summary,
                crate::audio::play_alarm,
            ])
            .build(tauri::test::mock_context(noop_assets()))
            .expect("failed to build mock Tauri app");
    }
}
