use app_lib::commands::git::parse_porcelain_status;
use app_lib::commands::git_binary::resolve_git_on_sources;
use std::ffi::OsStr;

#[cfg(unix)]
use std::fs;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
#[cfg(unix)]
use std::path::{Path, PathBuf};

#[test]
fn parse_unstaged_modified_keeps_leading_space_path() {
    let entry = parse_porcelain_status(" M README.md").expect("entry");
    assert_eq!(entry.path, "README.md");
    assert_eq!(entry.staged_status, None);
    assert_eq!(entry.unstaged_status.as_deref(), Some("M"));
    assert!(!entry.is_untracked);
}

#[test]
fn parse_trimmed_leading_space_corrupts_path() {
    // Documents the failure mode if stdout is fully trimmed before parse.
    let entry = parse_porcelain_status("M README.md").expect("entry");
    assert_eq!(entry.path, "EADME.md");
    assert_eq!(entry.staged_status.as_deref(), Some("M"));
}

#[test]
fn parse_staged_and_untracked() {
    let staged = parse_porcelain_status("M  src/main.rs").expect("staged");
    assert_eq!(staged.path, "src/main.rs");
    assert_eq!(staged.staged_status.as_deref(), Some("M"));
    assert_eq!(staged.unstaged_status, None);

    let untracked = parse_porcelain_status("?? new-file.ts").expect("untracked");
    assert_eq!(untracked.path, "new-file.ts");
    assert!(untracked.is_untracked);
}

#[test]
fn parse_rename() {
    let entry = parse_porcelain_status("R  old.ts -> new.ts").expect("rename");
    assert_eq!(entry.path, "new.ts");
    assert_eq!(entry.old_path.as_deref(), Some("old.ts"));
    assert_eq!(entry.staged_status.as_deref(), Some("R"));
}

#[cfg(unix)]
fn write_fake_bin(dir: &Path, name: &str) -> PathBuf {
    fs::create_dir_all(dir).expect("temp dir");
    let path = dir.join(name);
    fs::write(&path, "#!/bin/sh\n").expect("write fake bin");
    fs::set_permissions(&path, fs::Permissions::from_mode(0o755)).expect("chmod");
    path
}

#[cfg(unix)]
#[test]
fn current_path_wins_over_common_dirs() {
    let current = tempfile::tempdir().expect("current");
    let extra = tempfile::tempdir().expect("extra");
    let current_bin = write_fake_bin(current.path(), "vixl-git");
    write_fake_bin(extra.path(), "vixl-git");

    let found = resolve_git_on_sources(
        "vixl-git",
        Some(current.path().as_os_str()),
        &[extra.path().to_path_buf()],
    )
    .expect("resolve");
    assert_eq!(found, current_bin);
}

#[cfg(unix)]
#[test]
fn common_dirs_used_when_path_misses() {
    let extra = tempfile::tempdir().expect("extra");
    let extra_bin = write_fake_bin(extra.path(), "vixl-git");

    let found = resolve_git_on_sources(
        "vixl-git",
        Some(OsStr::new("")),
        &[extra.path().to_path_buf()],
    )
    .expect("resolve");
    assert_eq!(found, extra_bin);
}

#[test]
fn missing_git_uses_clear_error() {
    let error =
        resolve_git_on_sources("vixl-missing-git", Some(OsStr::new("")), &[]).expect_err("missing");
    assert_eq!(
        error,
        "git was not found on PATH or common install locations"
    );
}
