use std::fs;
use std::path::Path;

use crate::commands::file_checkpoint::{content_path, path_hash, read_manifest, write_manifest};

pub(crate) fn relocate_checkpoint_path(old_root: &str, new_root: &str, stored: &str) -> String {
    let stored_path = Path::new(stored);
    if stored.trim().is_empty() || stored_path.is_absolute() {
        return stored.to_string();
    }

    let joined = Path::new(old_root).join(stored_path);
    if let Some(relative) = strip_prefix_relative(&joined, Path::new(new_root)) {
        return relative;
    }

    match (
        Path::new(old_root).canonicalize(),
        Path::new(new_root).canonicalize(),
    ) {
        (Ok(old_canonical), Ok(new_canonical)) => {
            let joined = old_canonical.join(stored_path);
            strip_prefix_relative(&joined, &new_canonical).unwrap_or_else(|| stored.to_string())
        }
        _ => stored.to_string(),
    }
}

pub(crate) fn rewrite_file_checkpoints_for_root(
    chat_dir: &Path,
    old_root: &str,
    new_root: &str,
) -> Result<(), String> {
    let checkpoints = chat_dir.join("file-checkpoints");
    if !checkpoints.is_dir() {
        return Ok(());
    }

    for entry in fs::read_dir(&checkpoints).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        if !entry
            .file_type()
            .map_err(|error| error.to_string())?
            .is_dir()
        {
            continue;
        }
        rewrite_manifest_dir(&entry.path(), old_root, new_root)?;
    }
    Ok(())
}

fn strip_prefix_relative(path: &Path, prefix: &Path) -> Option<String> {
    let relative = path.strip_prefix(prefix).ok()?;
    let text = relative.to_string_lossy().replace('\\', "/");
    if text.is_empty() {
        None
    } else {
        Some(text)
    }
}

fn rewrite_manifest_dir(dir: &Path, old_root: &str, new_root: &str) -> Result<(), String> {
    let mut entries = read_manifest(dir)?;
    let mut changed = false;
    for entry in &mut entries {
        let relocated = relocate_checkpoint_path(old_root, new_root, &entry.path);
        if relocated == entry.path {
            continue;
        }
        let new_hash = path_hash(&relocated);
        rename_blob(dir, &entry.path_hash, &new_hash)?;
        entry.path = relocated;
        entry.path_hash = new_hash;
        changed = true;
    }
    if changed {
        write_manifest(dir, &entries)?;
    }
    Ok(())
}

fn rename_blob(dir: &Path, old_hash: &str, new_hash: &str) -> Result<(), String> {
    if old_hash == new_hash {
        return Ok(());
    }
    let from = content_path(dir, old_hash);
    let to = content_path(dir, new_hash);
    if !from.exists() {
        return Ok(());
    }
    if to.exists() {
        fs::remove_file(&from).map_err(|error| error.to_string())?;
        return Ok(());
    }
    fs::rename(from, to).map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{relocate_checkpoint_path, rewrite_file_checkpoints_for_root};
    use crate::commands::file_checkpoint::{content_path, path_hash, FileCheckpointBaseline};
    use std::fs;
    use std::path::PathBuf;
    use uuid::Uuid;

    struct TempChatDir {
        path: PathBuf,
    }

    impl TempChatDir {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!("vixl-rewrite-{}", Uuid::new_v4()));
            fs::create_dir_all(&path).expect("temp chat dir");
            Self { path }
        }
    }

    impl Drop for TempChatDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    #[test]
    fn relocates_path_when_file_lives_under_new_root() {
        let rewritten = relocate_checkpoint_path(
            "/Users/aidan",
            "/Users/aidan/Documents/my-game",
            "Documents/my-game/index.html",
        );
        assert_eq!(rewritten, "index.html");
    }

    #[test]
    fn leaves_path_when_file_is_outside_new_root() {
        let rewritten = relocate_checkpoint_path(
            "/Users/aidan/other",
            "/Users/aidan/Documents/my-game",
            "lib.rs",
        );
        assert_eq!(rewritten, "lib.rs");
    }

    #[test]
    fn rewrite_updates_manifest_and_blob_name() {
        let chat = TempChatDir::new();
        let old_root = "/Users/aidan";
        let new_root = "/Users/aidan/Documents/my-game";
        let stored = "Documents/my-game/index.html";
        let message_dir = chat.path.join("file-checkpoints").join("msg-1");
        fs::create_dir_all(&message_dir).expect("checkpoint dir");
        let old_hash = path_hash(stored);
        fs::write(content_path(&message_dir, &old_hash), b"hello").expect("blob");
        let manifest = vec![FileCheckpointBaseline {
            path: stored.to_string(),
            path_hash: old_hash.clone(),
            existed: true,
            captured_at: "2026-01-01T00:00:00Z".to_string(),
            tool_call_id: None,
        }];
        fs::write(
            message_dir.join("manifest.json"),
            serde_json::to_string(&manifest).expect("manifest json"),
        )
        .expect("write manifest");

        rewrite_file_checkpoints_for_root(&chat.path, old_root, new_root).expect("rewrite");

        let raw = fs::read_to_string(message_dir.join("manifest.json")).expect("read manifest");
        let updated: Vec<FileCheckpointBaseline> =
            serde_json::from_str(&raw).expect("parse manifest");
        assert_eq!(updated.len(), 1);
        assert_eq!(updated[0].path, "index.html");
        let new_hash = path_hash("index.html");
        assert_eq!(updated[0].path_hash, new_hash);
        assert!(content_path(&message_dir, &new_hash).exists());
        assert!(!content_path(&message_dir, &old_hash).exists());
    }
}
