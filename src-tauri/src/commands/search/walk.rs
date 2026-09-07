use std::path::Path;

use ignore::overrides::OverrideBuilder;
use ignore::WalkBuilder;

pub fn walk_builder(
    root: &Path,
    include_glob: Option<&str>,
    exclude_glob: Option<&str>,
    case_insensitive: bool,
) -> Result<WalkBuilder, String> {
    let mut builder = WalkBuilder::new(root);
    builder
        .hidden(true)
        .parents(true)
        .ignore(true)
        .git_ignore(true)
        .git_global(true)
        .git_exclude(true)
        .require_git(true)
        .follow_links(false);

    let include = include_glob
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let exclude = exclude_glob
        .map(str::trim)
        .filter(|value| !value.is_empty());

    if let Some(pattern) = exclude {
        let mut overrides = OverrideBuilder::new(root);
        if case_insensitive {
            overrides
                .case_insensitive(true)
                .map_err(|error| error.to_string())?;
        }
        overrides
            .add(&exclude_override(pattern))
            .map_err(|error| error.to_string())?;
        builder.overrides(overrides.build().map_err(|error| error.to_string())?);
    }

    // Include globs are applied after ignore rules. Putting them on OverrideBuilder
    // would whitelist matches and skip .gitignore / hidden filtering.
    if let Some(pattern) = include {
        let mut include_overrides = OverrideBuilder::new(root);
        if case_insensitive {
            include_overrides
                .case_insensitive(true)
                .map_err(|error| error.to_string())?;
        }
        include_overrides
            .add(pattern)
            .map_err(|error| error.to_string())?;
        let include_matcher = include_overrides
            .build()
            .map_err(|error| error.to_string())?;
        builder.filter_entry(move |entry| {
            let is_dir = entry.file_type().is_some_and(|kind| kind.is_dir());
            if is_dir {
                return true;
            }
            !include_matcher.matched(entry.path(), false).is_ignore()
        });
    }

    Ok(builder)
}

fn exclude_override(pattern: &str) -> String {
    if pattern.starts_with('!') {
        pattern.to_string()
    } else {
        format!("!{pattern}")
    }
}
