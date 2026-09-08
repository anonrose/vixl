use std::fs;

use app_lib::commands::config::{
    apply_mcp_server_enabled, set_mcp_server_enabled_at_path, write_json,
};

fn sample_mcp() -> String {
    String::from(
        r#"{
  "inputs": [
    {
      "id": "token",
      "type": "promptString"
    }
  ],
  "servers": {
    "keep": {
      "command": "npx",
      "args": ["echo", "keep {braces} and \"quotes\""],
      "enabled": true
    },
    "target": {
      "command": "npx",
      "args": ["echo", "hello {world} \"quoted\""],
      "env": {
        "FOO": "a{b}"
      }
    }
  }
}
"#,
    )
}

#[test]
fn replace_existing_enabled_literal() {
    let raw = r#"{
  "servers": {
    "target": {
      "command": "npx",
      "enabled": true
    }
  }
}"#;
    let patched = apply_mcp_server_enabled(raw, "target", false)
        .unwrap()
        .expect("write");
    assert!(patched.contains("\"enabled\": false"));
    assert!(!patched.contains("\"enabled\": true"));
    assert_eq!(
        patched.replace("\"enabled\": false", "\"enabled\": true"),
        raw
    );
}

#[test]
fn insert_missing_enabled_two_space_indent() {
    let raw = sample_mcp();
    let patched = apply_mcp_server_enabled(&raw, "target", false)
        .unwrap()
        .expect("write");
    assert!(patched
        .contains("    \"target\": {\n      \"enabled\": false,\n      \"command\": \"npx\""));
    assert!(patched.contains("\"inputs\""));
    assert_eq!(patched.replace("      \"enabled\": false,\n", ""), raw);
    assert!(patched.contains("\"enabled\": true"));
}

#[test]
fn insert_missing_enabled_four_space_indent() {
    let raw = r#"{
    "servers": {
        "target": {
            "command": "npx"
        }
    }
}"#;
    let patched = apply_mcp_server_enabled(raw, "target", false)
        .unwrap()
        .expect("write");
    assert!(patched.contains(
        "        \"target\": {\n            \"enabled\": false,\n            \"command\": \"npx\""
    ));
}

#[test]
fn insert_missing_enabled_tab_indent() {
    let raw = "{\n\t\"servers\": {\n\t\t\"target\": {\n\t\t\t\"command\": \"npx\"\n\t\t}\n\t}\n}";
    let patched = apply_mcp_server_enabled(raw, "target", false)
        .unwrap()
        .expect("write");
    assert!(patched
        .contains("\t\t\"target\": {\n\t\t\t\"enabled\": false,\n\t\t\t\"command\": \"npx\""));
}

#[test]
fn nested_braces_and_quotes_do_not_shift_patch() {
    let raw = sample_mcp();
    let patched = apply_mcp_server_enabled(&raw, "target", false)
        .unwrap()
        .expect("write");
    assert!(patched.contains("hello {world} \\\"quoted\\\""));
    assert!(patched.contains("\"FOO\": \"a{b}\""));
    assert!(patched.contains("keep {braces} and \\\"quotes\\\""));
}

#[test]
fn only_target_server_changes_among_multiple() {
    let raw = sample_mcp();
    let patched = apply_mcp_server_enabled(&raw, "target", false)
        .unwrap()
        .expect("write");
    let keep_start = raw.find("\"keep\"").unwrap();
    let keep_end = raw.find("\"target\"").unwrap();
    assert_eq!(&patched[keep_start..keep_end], &raw[keep_start..keep_end]);
}

#[test]
fn inputs_top_level_key_is_byte_identical() {
    let raw = sample_mcp();
    let patched = apply_mcp_server_enabled(&raw, "target", false)
        .unwrap()
        .expect("write");
    let inputs_start = raw.find("\"inputs\"").unwrap();
    let inputs_end = raw.find("\"servers\"").unwrap();
    assert_eq!(
        &patched[inputs_start..inputs_end],
        &raw[inputs_start..inputs_end]
    );
}

#[test]
fn crlf_line_endings_are_preserved() {
    let raw = "{\r\n  \"servers\": {\r\n    \"target\": {\r\n      \"command\": \"npx\"\r\n    }\r\n  }\r\n}";
    let patched = apply_mcp_server_enabled(raw, "target", false)
        .unwrap()
        .expect("write");
    assert!(patched.contains("\r\n      \"enabled\": false,\r\n"));
    assert_eq!(patched.replace("      \"enabled\": false,\r\n", ""), raw);
}

#[test]
fn noop_when_effective_state_already_matches() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("mcp.json");
    let raw = sample_mcp();
    fs::write(&path, &raw).unwrap();
    let wrote = set_mcp_server_enabled_at_path(&path, "target", true).unwrap();
    assert!(!wrote);
    assert_eq!(fs::read_to_string(&path).unwrap(), raw);
}

#[test]
fn surgical_write_preserves_rest_of_file() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("mcp.json");
    let raw = sample_mcp();
    fs::write(&path, &raw).unwrap();
    let wrote = set_mcp_server_enabled_at_path(&path, "target", false).unwrap();
    assert!(wrote);
    let patched = fs::read_to_string(&path).unwrap();
    assert_eq!(patched.replace("      \"enabled\": false,\n", ""), raw);
}

#[test]
fn missing_file_returns_error() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("mcp.json");
    let err = set_mcp_server_enabled_at_path(&path, "target", false).unwrap_err();
    assert!(err.contains("does not exist"));
}

#[test]
fn missing_server_returns_error() {
    let err = apply_mcp_server_enabled(&sample_mcp(), "missing", false).unwrap_err();
    assert!(err.contains("not found"));
}

#[test]
fn atomic_write_json_leaves_no_temp_files() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("mcp.json");
    write_json(
        &path,
        serde_json::json!({"servers": {"a": {"command": "npx"}}}),
    )
    .unwrap();
    let content = fs::read_to_string(&path).unwrap();
    assert!(content.contains("\"servers\""));
    let leftovers: Vec<_> = fs::read_dir(dir.path())
        .unwrap()
        .map(|entry| entry.unwrap().file_name())
        .collect();
    assert_eq!(leftovers.len(), 1);
    assert_eq!(leftovers[0], "mcp.json");
    let names: Vec<String> = leftovers
        .iter()
        .map(|name| name.to_string_lossy().into_owned())
        .collect();
    assert!(names.iter().all(|name| !name.contains(".tmp-")));
}
