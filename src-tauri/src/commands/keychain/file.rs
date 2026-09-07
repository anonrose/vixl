use std::fs::{self, OpenOptions};
use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

use super::vault::{serialize_vault, vault_from_file_read, LoadedVault, VaultMap};

pub const VAULT_FILE_NAME: &str = "secrets-vault.json";

pub fn vault_file_path(config_dir: &Path) -> PathBuf {
    config_dir.join(VAULT_FILE_NAME)
}

pub fn vault_file_path_for_app(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|err| format!("Failed to resolve app config directory ({err})"))?;
    Ok(vault_file_path(&dir))
}

pub fn read_vault_file(path: &Path) -> Result<LoadedVault, String> {
    match fs::read_to_string(path) {
        Ok(payload) => vault_from_file_read(Some(&payload)),
        Err(err) if err.kind() == ErrorKind::NotFound => vault_from_file_read(None),
        Err(err) => Err(format!("Failed to read secret vault file ({err})")),
    }
}

pub fn write_vault_file(path: &Path, map: &VaultMap) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|err| format!("Failed to create secret vault directory ({err})"))?;
    }

    let payload = serialize_vault(map)?;
    let mut opts = OpenOptions::new();
    opts.write(true).create(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        opts.mode(0o600);
    }

    let mut file = opts
        .open(path)
        .map_err(|err| format!("Failed to open secret vault file ({err})"))?;
    file.write_all(payload.as_bytes())
        .map_err(|err| format!("Failed to write secret vault file ({err})"))?;
    file.sync_all()
        .map_err(|err| format!("Failed to sync secret vault file ({err})"))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600))
            .map_err(|err| format!("Failed to set secret vault file permissions ({err})"))?;
    }

    Ok(())
}
