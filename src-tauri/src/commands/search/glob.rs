use std::path::Path;

use serde::{Deserialize, Serialize};

use super::walk::walk_builder;
use crate::commands::fs::canonical_project_root;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceGlobRequest {
    pub project_root: String,
    pub pattern: String,
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobFileEntry {
    pub path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceGlobResult {
    pub files: Vec<GlobFileEntry>,
    pub truncated: bool,
}

#[tauri::command]
pub async fn workspace_glob(request: WorkspaceGlobRequest) -> Result<WorkspaceGlobResult, String> {
    if request.pattern.trim().is_empty() {
        return Err("Glob pattern is required".to_string());
    }

    let root = canonical_project_root(&request.project_root)?;
    let limit = request.limit.unwrap_or(500) as usize;
    let pattern = request.pattern.clone();

    tokio::task::spawn_blocking(move || collect_glob_files(&root, &pattern, limit))
        .await
        .map_err(|error| format!("Glob search failed: {error}"))?
}

fn collect_glob_files(
    root: &Path,
    pattern: &str,
    limit: usize,
) -> Result<WorkspaceGlobResult, String> {
    let collect_limit = limit.saturating_add(1);
    let walker = walk_builder(root, Some(pattern), None, true)?;
    let mut files = Vec::new();
    let mut truncated = false;

    for entry in walker.build() {
        let Ok(entry) = entry else {
            continue;
        };
        if !entry.file_type().is_some_and(|kind| kind.is_file()) {
            continue;
        }

        let Ok(rel) = entry.path().strip_prefix(root) else {
            continue;
        };

        files.push(GlobFileEntry {
            path: rel.to_string_lossy().to_string(),
        });

        if files.len() >= collect_limit {
            truncated = true;
            break;
        }
    }

    if truncated {
        files.truncate(limit);
    }

    files.sort_by(|left, right| left.path.cmp(&right.path));

    Ok(WorkspaceGlobResult { files, truncated })
}
