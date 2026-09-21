use std::fs;
use tauri::Manager;

#[tauri::command]
fn is_hyprland() -> bool {
    std::env::var("HYPRLAND_INSTANCE_SIGNATURE").is_ok()
        || std::env::var("XDG_CURRENT_DESKTOP")
            .map(|v| v.to_lowercase().contains("hyprland"))
            .unwrap_or(false)
}

#[derive(Clone, serde::Serialize)]
struct DownloadProgressPayload {
    downloaded: u64,
    total: Option<u64>,
    percentage: f32,
    done: bool,
    path: Option<String>,
}

#[tauri::command]
async fn download_app_update(
    app: tauri::AppHandle,
    url: String,
    filename: Option<String>,
) -> Result<String, String> {
    use futures_util::StreamExt;
    use std::io::Write;
    use tauri::Emitter;

    let target_dir = app
        .path()
        .app_cache_dir()
        .or_else(|_| app.path().app_local_data_dir())
        .map_err(|e| e.to_string())?;

    let updates_dir = target_dir.join("updates");
    fs::create_dir_all(&updates_dir).map_err(|e| e.to_string())?;

    let file_name = filename.unwrap_or_else(|| "update.apk".to_string());
    let dest_path = updates_dir.join(&file_name);

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header(reqwest::header::USER_AGENT, "InsightBook-App")
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?
        .error_for_status()
        .map_err(|e| format!("Status error: {e}"))?;

    let total_size = response.content_length();
    let mut downloaded: u64 = 0;

    let mut file = fs::File::create(&dest_path).map_err(|e| e.to_string())?;
    let mut stream = response.bytes_stream();

    let _ = app.emit(
        "app-update://progress",
        DownloadProgressPayload {
            downloaded: 0,
            total: total_size,
            percentage: 0.0,
            done: false,
            path: None,
        },
    );

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Error downloading chunk: {e}"))?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;

        let percentage = match total_size {
            Some(total) if total > 0 => {
                ((downloaded as f64 / total as f64) * 100.0) as f32
            }
            _ => 0.0,
        };

        let _ = app.emit(
            "app-update://progress",
            DownloadProgressPayload {
                downloaded,
                total: total_size,
                percentage,
                done: false,
                path: None,
            },
        );
    }

    file.flush().map_err(|e| e.to_string())?;

    let final_path = dest_path.display().to_string();

    let _ = app.emit(
        "app-update://progress",
        DownloadProgressPayload {
            downloaded,
            total: total_size,
            percentage: 100.0,
            done: true,
            path: Some(final_path.clone()),
        },
    );

    Ok(final_path)
}

#[tauri::command]
async fn open_downloaded_apk(app: tauri::AppHandle, path: String) -> Result<(), String> {
    #[cfg(mobile)]
    {
        use tauri_plugin_apk_installer::{ApkInstallerExt, InstallApkPayload};
        app.apk_installer()
            .install_apk(InstallApkPayload { path })
            .map(|_| ())
            .map_err(|e| e.to_string())
    }

    #[cfg(desktop)]
    {
        use tauri_plugin_opener::OpenerExt;
        app.opener()
            .open_path(path, None::<&str>)
            .map_err(|e| e.to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_apk_installer::init())
        .invoke_handler(tauri::generate_handler![
            is_hyprland,
            download_app_update,
            open_downloaded_apk
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
