use std::env;
use std::ffi::OsStr;
use std::path::PathBuf;
use std::sync::OnceLock;

const GIT_NOT_FOUND: &str = "git was not found on PATH or common install locations";

static GIT_BINARY: OnceLock<Result<PathBuf, String>> = OnceLock::new();

pub fn git_binary() -> Result<PathBuf, String> {
    GIT_BINARY.get_or_init(find_git).clone()
}

fn find_git() -> Result<PathBuf, String> {
    if let Ok(path) = which::which("git") {
        return Ok(path);
    }
    if let Some(path) = which_on_dirs("git", &common_git_dirs()) {
        return Ok(path);
    }
    Err(GIT_NOT_FOUND.to_string())
}

pub fn resolve_git_on_sources(
    basename: &str,
    current_path: Option<&OsStr>,
    extra_dirs: &[PathBuf],
) -> Result<PathBuf, String> {
    if let Some(path) = which_on_path(basename, current_path) {
        return Ok(path);
    }
    if let Some(path) = which_on_dirs(basename, extra_dirs) {
        return Ok(path);
    }
    Err(GIT_NOT_FOUND.to_string())
}

fn which_on_path(basename: &str, path: Option<&OsStr>) -> Option<PathBuf> {
    which::which_in_global(basename, path)
        .ok()
        .and_then(|mut found| found.next())
}

fn which_on_dirs(basename: &str, dirs: &[PathBuf]) -> Option<PathBuf> {
    let joined = env::join_paths(dirs.iter()).ok()?;
    which_on_path(basename, Some(joined.as_os_str()))
}

fn common_git_dirs() -> Vec<PathBuf> {
    #[cfg(windows)]
    {
        vec![
            PathBuf::from(r"C:\Program Files\Git\cmd"),
            PathBuf::from(r"C:\Program Files (x86)\Git\cmd"),
        ]
    }
    #[cfg(not(windows))]
    {
        vec![
            PathBuf::from("/usr/bin"),
            PathBuf::from("/usr/local/bin"),
            PathBuf::from("/opt/homebrew/bin"),
        ]
    }
}
