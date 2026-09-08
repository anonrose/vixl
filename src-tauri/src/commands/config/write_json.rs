use std::fs;
use std::io::Write;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};

static TMP_COUNTER: AtomicU64 = AtomicU64::new(0);

pub fn write_json(path: &Path, value: serde_json::Value) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(&value).map_err(|e| e.to_string())?;
    write_atomic(path, &content)
}

pub fn write_atomic(path: &Path, content: &str) -> Result<(), String> {
    let parent = match path.parent() {
        Some(parent) if !parent.as_os_str().is_empty() => parent,
        _ => Path::new("."),
    };
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "invalid config path".to_string())?;
    let pid = std::process::id();
    let n = TMP_COUNTER.fetch_add(1, Ordering::Relaxed);
    let tmp = parent.join(format!("{name}.tmp-{pid}-{n}"));
    let result = write_atomic_inner(&tmp, path, content);
    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result
}

fn write_atomic_inner(tmp: &Path, path: &Path, content: &str) -> Result<(), String> {
    {
        let mut file = fs::File::create(tmp).map_err(|e| e.to_string())?;
        file.write_all(content.as_bytes())
            .map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
    }
    rename_replace(tmp, path).map_err(|e| e.to_string())
}

fn rename_replace(from: &Path, to: &Path) -> std::io::Result<()> {
    match fs::rename(from, to) {
        Ok(()) => Ok(()),
        Err(err) => {
            #[cfg(windows)]
            {
                let _ = err;
                if to.exists() {
                    fs::remove_file(to)?;
                }
                fs::rename(from, to)
            }
            #[cfg(not(windows))]
            Err(err)
        }
    }
}
