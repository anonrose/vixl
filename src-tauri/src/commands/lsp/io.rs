use std::io::ErrorKind;
use std::sync::Arc;

use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};
use tokio::process::ChildStderr;
use tokio::sync::Mutex;

const STDERR_TAIL_LIMIT: usize = 4_000;

pub fn spawn_stderr_tail(stderr: ChildStderr, tail: Arc<Mutex<String>>) {
    tokio::spawn(async move {
        let mut lines = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let mut guard = tail.lock().await;
            if guard.len() < STDERR_TAIL_LIMIT {
                if !guard.is_empty() {
                    guard.push('\n');
                }
                guard.push_str(&line);
            }
        }
    });
}

pub fn append_stderr_snippet(message: String, stderr: &str) -> String {
    let trimmed = stderr.trim();
    if trimmed.is_empty() {
        message
    } else {
        format!("{message}\n{trimmed}")
    }
}

pub fn lsp_request_timeout_error(timeout_secs: u64, method: &str) -> String {
    format!("LSP request timed out after {timeout_secs}s ({method})")
}

pub fn lsp_invalid_stream_error(detail: &str) -> String {
    format!("{detail}: stream was not valid LSP")
}

fn map_read_error(error: std::io::Error, header: &[u8]) -> String {
    if error.kind() != ErrorKind::UnexpectedEof {
        return error.to_string();
    }
    if header.is_empty() {
        "Language server exited".to_string()
    } else {
        lsp_invalid_stream_error("Incomplete LSP header")
    }
}

pub async fn read_lsp_message<R>(reader: &mut BufReader<R>) -> Result<serde_json::Value, String>
where
    R: AsyncReadExt + Unpin,
{
    let mut header = Vec::new();
    let mut byte = [0u8; 1];

    loop {
        reader
            .read_exact(&mut byte)
            .await
            .map_err(|error| map_read_error(error, &header))?;
        header.push(byte[0]);
        if header.len() >= 4 && header.ends_with(b"\r\n\r\n") {
            break;
        }
        if header.len() > 8192 {
            return Err(lsp_invalid_stream_error("Invalid LSP header"));
        }
    }

    let header_text = String::from_utf8_lossy(&header);
    let mut content_length = None;
    for line in header_text.lines() {
        if let Some((key, value)) = line.split_once(':') {
            if key.trim().eq_ignore_ascii_case("Content-Length") {
                content_length = value.trim().parse::<usize>().ok();
            }
        }
    }

    let content_length =
        content_length.ok_or_else(|| lsp_invalid_stream_error("Missing Content-Length header"))?;
    let mut body = vec![0u8; content_length];
    reader.read_exact(&mut body).await.map_err(|error| {
        if error.kind() == ErrorKind::UnexpectedEof {
            "Language server exited".to_string()
        } else {
            error.to_string()
        }
    })?;
    serde_json::from_slice(&body)
        .map_err(|error| lsp_invalid_stream_error(&format!("Invalid LSP JSON ({error})")))
}
