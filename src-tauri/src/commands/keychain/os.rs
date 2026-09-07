use keyring::Entry;

use super::backend::{choose_secret_backend, classify_keyring_access_failure, SecretBackendKind};
use super::vault::{serialize_vault, vault_from_os_read, LoadedVault, VaultMap, VAULT_ACCOUNT};

const SERVICE: &str = "vixl";

pub fn map_keyring_error(err: keyring::Error) -> String {
    match err {
        keyring::Error::NoEntry => "No entry".to_string(),
        keyring::Error::PlatformFailure(inner) => {
            format!(
        "OS keychain unavailable ({inner}). On Linux, ensure a Secret Service provider (for example gnome-keyring) is running."
      )
        }
        keyring::Error::NoStorageAccess(inner) => {
            format!(
        "OS keychain access denied ({inner}). Unlock your system keyring or grant vixl access."
      )
        }
        other => other.to_string(),
    }
}

fn vault_entry() -> Result<Entry, String> {
    Entry::new(SERVICE, VAULT_ACCOUNT).map_err(map_keyring_error)
}

fn legacy_entry(key: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, key).map_err(map_keyring_error)
}

fn probe_os_keychain() -> Result<(), keyring::Error> {
    let entry = Entry::new(SERVICE, VAULT_ACCOUNT)?;
    match entry.get_password() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(err),
    }
}

pub fn detect_backend() -> Result<SecretBackendKind, String> {
    let is_linux = cfg!(target_os = "linux");
    if !is_linux {
        return Ok(SecretBackendKind::OsKeychain);
    }
    match probe_os_keychain() {
        Ok(()) => Ok(choose_secret_backend(true, None)),
        Err(err) => match classify_keyring_access_failure(&err) {
            Some(failure) => Ok(choose_secret_backend(true, Some(failure))),
            None => Err(map_keyring_error(err)),
        },
    }
}

pub fn read_vault_from_os() -> Result<LoadedVault, String> {
    match vault_entry()?.get_password() {
        Ok(payload) => vault_from_os_read(Some(&payload)),
        Err(keyring::Error::NoEntry) => vault_from_os_read(None),
        Err(err) => Err(map_keyring_error(err)),
    }
}

pub fn write_vault_to_os(map: &VaultMap) -> Result<(), String> {
    let payload = serialize_vault(map)?;
    vault_entry()?
        .set_password(&payload)
        .map_err(map_keyring_error)
}

pub fn read_legacy_secret(key: &str) -> Result<Option<String>, String> {
    match legacy_entry(key)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(err) => Err(map_keyring_error(err)),
    }
}

pub fn delete_legacy_secret(key: &str) -> Result<(), String> {
    match legacy_entry(key)?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(map_keyring_error(err)),
    }
}
