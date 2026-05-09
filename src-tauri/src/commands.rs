use std::fs;
use std::path::PathBuf;
use tauri::Manager;

fn data_sqlite_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.join("data.sqlite"))
}

fn backup_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let backup = dir.join("backup");
    fs::create_dir_all(&backup).map_err(|e| e.to_string())?;
    Ok(backup)
}

#[tauri::command]
pub fn snapshot_db(app: tauri::AppHandle) -> Result<String, String> {
    let src = data_sqlite_path(&app)?;
    let dest_dir = backup_dir(&app)?;
    let ts = chrono::Utc::now().format("%Y%m%dT%H%M%S").to_string();
    let dest = dest_dir.join(format!("import-{ts}.sqlite"));
    fs::copy(&src, &dest).map_err(|e| e.to_string())?;
    Ok(dest.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn restore_snapshot(app: tauri::AppHandle, snapshot_path: String) -> Result<(), String> {
    let src = PathBuf::from(snapshot_path);
    let dest = data_sqlite_path(&app)?;
    fs::copy(&src, &dest).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn open_data_dir(app: tauri::AppHandle) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer").arg(dir).spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open").arg(dir).spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open").arg(dir).spawn().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn prune_old_snapshots(app: tauri::AppHandle, max_age_days: u64) -> Result<u64, String> {
    let dir = backup_dir(&app)?;
    let cutoff = std::time::SystemTime::now()
        .checked_sub(std::time::Duration::from_secs(max_age_days * 86400))
        .ok_or("time arithmetic underflow")?;
    let mut removed = 0u64;
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let modified = entry.metadata().and_then(|m| m.modified()).map_err(|e| e.to_string())?;
        if modified < cutoff {
            fs::remove_file(entry.path()).map_err(|e| e.to_string())?;
            removed += 1;
        }
    }
    Ok(removed)
}
