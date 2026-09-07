#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SecretBackendKind {
    OsKeychain,
    ConfigFile,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum KeyringAccessFailure {
    PlatformFailure,
    NoStorageAccess,
}

pub fn classify_keyring_access_failure(err: &keyring::Error) -> Option<KeyringAccessFailure> {
    match err {
        keyring::Error::PlatformFailure(_) => Some(KeyringAccessFailure::PlatformFailure),
        keyring::Error::NoStorageAccess(_) => Some(KeyringAccessFailure::NoStorageAccess),
        _ => None,
    }
}

pub fn choose_secret_backend(
    is_linux: bool,
    keyring_access_failure: Option<KeyringAccessFailure>,
) -> SecretBackendKind {
    if is_linux && keyring_access_failure.is_some() {
        SecretBackendKind::ConfigFile
    } else {
        SecretBackendKind::OsKeychain
    }
}

#[cfg(test)]
mod tests {
    use super::{classify_keyring_access_failure, KeyringAccessFailure};
    use std::io::ErrorKind;

    #[test]
    fn classify_platform_and_storage_failures() {
        let platform = keyring::Error::PlatformFailure(Box::new(std::io::Error::new(
            ErrorKind::Other,
            "secret service missing",
        )));
        let denied = keyring::Error::NoStorageAccess(Box::new(std::io::Error::new(
            ErrorKind::PermissionDenied,
            "locked",
        )));
        assert_eq!(
            classify_keyring_access_failure(&platform),
            Some(KeyringAccessFailure::PlatformFailure)
        );
        assert_eq!(
            classify_keyring_access_failure(&denied),
            Some(KeyringAccessFailure::NoStorageAccess)
        );
        assert_eq!(
            classify_keyring_access_failure(&keyring::Error::NoEntry),
            None
        );
    }
}
