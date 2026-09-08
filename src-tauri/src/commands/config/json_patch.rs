pub fn patch_server_enabled(raw: &str, server_id: &str, enabled: bool) -> Result<String, String> {
    let root = expect_object(raw, skip_ws(raw, 0))?;
    let servers = find_object_property(raw, root, "servers")?
        .ok_or_else(|| "mcp.json is missing a servers object".to_string())?;
    let servers_obj = expect_object(raw, servers.value_start)?;
    let server = find_object_property(raw, servers_obj, server_id)?
        .ok_or_else(|| format!("MCP server not found: {server_id}"))?;
    let server_obj = expect_object(raw, server.value_start)?;
    match find_object_property(raw, server_obj, "enabled")? {
        Some(enabled_prop) => replace_bool_literal(raw, enabled_prop.value_start, enabled),
        None => insert_enabled_property(raw, server_obj, enabled),
    }
}

struct Property {
    value_start: usize,
}

fn expect_object(raw: &str, start: usize) -> Result<usize, String> {
    let start = skip_ws(raw, start);
    if raw.as_bytes().get(start) != Some(&b'{') {
        return Err("expected a JSON object".to_string());
    }
    Ok(start)
}

fn find_object_property(raw: &str, brace: usize, name: &str) -> Result<Option<Property>, String> {
    let bytes = raw.as_bytes();
    let mut i = brace + 1;
    loop {
        i = skip_ws(raw, i);
        if i >= bytes.len() {
            return Err("unterminated JSON object".to_string());
        }
        if bytes[i] == b'}' {
            return Ok(None);
        }
        if bytes[i] != b'"' {
            return Err("expected object key".to_string());
        }
        let key_end = skip_string(raw, i)?;
        let key: String = serde_json::from_str(&raw[i..key_end]).map_err(|e| e.to_string())?;
        i = skip_ws(raw, key_end);
        if bytes.get(i) != Some(&b':') {
            return Err("expected colon after object key".to_string());
        }
        i += 1;
        i = skip_ws(raw, i);
        let value_start = i;
        i = skip_value(raw, i)?;
        if key == name {
            return Ok(Some(Property { value_start }));
        }
        i = skip_ws(raw, i);
        if bytes.get(i) == Some(&b',') {
            i += 1;
        }
    }
}

fn replace_bool_literal(raw: &str, value_start: usize, enabled: bool) -> Result<String, String> {
    let rest = &raw[value_start..];
    let old_len = if rest.starts_with("true") {
        4
    } else if rest.starts_with("false") {
        5
    } else {
        return Err("enabled is not a boolean".to_string());
    };
    let new = if enabled { "true" } else { "false" };
    let mut out = String::with_capacity(raw.len() - old_len + new.len());
    out.push_str(&raw[..value_start]);
    out.push_str(new);
    out.push_str(&raw[value_start + old_len..]);
    Ok(out)
}

fn insert_enabled_property(raw: &str, brace: usize, enabled: bool) -> Result<String, String> {
    let insert = enabled_insert_text(raw, brace, enabled)?;
    let mut out = String::with_capacity(raw.len() + insert.len());
    out.push_str(&raw[..=brace]);
    out.push_str(&insert);
    out.push_str(&raw[brace + 1..]);
    Ok(out)
}

fn enabled_insert_text(raw: &str, brace: usize, enabled: bool) -> Result<String, String> {
    let bool_lit = if enabled { "true" } else { "false" };
    let after = brace + 1;
    let first = skip_ws(raw, after);
    if raw.as_bytes().get(first) == Some(&b'}') {
        return Ok(format!(" \"enabled\": {bool_lit} "));
    }
    let ws = &raw[after..first];
    if let Some(newline) = newline_in(ws) {
        let indent = match ws.rsplit_once('\n') {
            Some((_, tail)) => tail.trim_end_matches('\r'),
            None => "",
        };
        return Ok(format!("{newline}{indent}\"enabled\": {bool_lit},"));
    }
    Ok(format!(" \"enabled\": {bool_lit},"))
}

fn newline_in(ws: &str) -> Option<&'static str> {
    if ws.contains("\r\n") {
        Some("\r\n")
    } else if ws.contains('\n') {
        Some("\n")
    } else {
        None
    }
}

fn skip_ws(raw: &str, mut i: usize) -> usize {
    let bytes = raw.as_bytes();
    while i < bytes.len() && matches!(bytes[i], b' ' | b'\t' | b'\n' | b'\r') {
        i += 1;
    }
    i
}

fn skip_string(raw: &str, start: usize) -> Result<usize, String> {
    let bytes = raw.as_bytes();
    let mut i = start + 1;
    while i < bytes.len() {
        match bytes[i] {
            b'\\' => {
                i += 1;
                if i >= bytes.len() {
                    return Err("unterminated JSON string escape".to_string());
                }
                i += 1;
            }
            b'"' => return Ok(i + 1),
            _ => i += 1,
        }
    }
    Err("unterminated JSON string".to_string())
}

fn skip_literal(raw: &str, start: usize, literal: &str) -> Result<usize, String> {
    if raw[start..].starts_with(literal) {
        Ok(start + literal.len())
    } else {
        Err(format!("expected {literal}"))
    }
}

fn skip_number(raw: &str, mut i: usize) -> Result<usize, String> {
    let bytes = raw.as_bytes();
    if i >= bytes.len() {
        return Err("expected number".to_string());
    }
    if bytes[i] == b'-' {
        i += 1;
    }
    let start = i;
    while i < bytes.len() && matches!(bytes[i], b'0'..=b'9' | b'.' | b'e' | b'E' | b'+' | b'-') {
        i += 1;
    }
    if i == start {
        return Err("expected number".to_string());
    }
    Ok(i)
}

fn skip_object(raw: &str, start: usize) -> Result<usize, String> {
    skip_delimited(raw, start, b'{', b'}')
}

fn skip_array(raw: &str, start: usize) -> Result<usize, String> {
    skip_delimited(raw, start, b'[', b']')
}

fn skip_delimited(raw: &str, start: usize, open: u8, close: u8) -> Result<usize, String> {
    let bytes = raw.as_bytes();
    let mut i = start + 1;
    while i < bytes.len() {
        match bytes[i] {
            b if b == close => return Ok(i + 1),
            b if b == open => {
                i = skip_delimited(raw, i, open, close)?;
            }
            b'"' => i = skip_string(raw, i)?,
            _ => i += 1,
        }
    }
    Err("unterminated JSON container".to_string())
}

fn skip_value(raw: &str, start: usize) -> Result<usize, String> {
    let i = skip_ws(raw, start);
    let bytes = raw.as_bytes();
    match bytes.get(i) {
        Some(b'"') => skip_string(raw, i),
        Some(b'{') => skip_object(raw, i),
        Some(b'[') => skip_array(raw, i),
        Some(b't') => skip_literal(raw, i, "true"),
        Some(b'f') => skip_literal(raw, i, "false"),
        Some(b'n') => skip_literal(raw, i, "null"),
        Some(b'-') | Some(b'0'..=b'9') => skip_number(raw, i),
        _ => Err("unexpected JSON value".to_string()),
    }
}
