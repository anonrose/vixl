use std::collections::HashMap;
use std::sync::Arc;

use tokio::io::AsyncWriteExt;
use tokio::process::{Child, ChildStdin};
use tokio::sync::{oneshot, Mutex};
use tokio::time::{sleep, Duration};

use super::super::lsp_install::{with_timeout, LSP_WRITE_TIMEOUT};
use super::helpers::LspServerStatus;
use super::io::{append_stderr_snippet, lsp_request_timeout_error};

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct LspDiagnosticProvider {
    pub workspace_diagnostics: bool,
    pub identifier: Option<String>,
}

pub(crate) struct LspProcess {
    pub(crate) child: Child,
    pub(crate) stdin: ChildStdin,
    pub(crate) workspace_root: String,
    pub(crate) open_documents: HashMap<String, i32>,
    pub(crate) diagnostics_by_uri: HashMap<String, serde_json::Value>,
    pub(crate) diagnostic_provider: Option<LspDiagnosticProvider>,
    pub(crate) pending: Mutex<HashMap<u64, oneshot::Sender<serde_json::Value>>>,
    pub(crate) next_id: Mutex<u64>,
    pub(crate) uses_classic_typescript: bool,
    pub(crate) stderr_tail: Arc<Mutex<String>>,
}

pub(crate) struct ManagedLspServer {
    pub(crate) process: Arc<Mutex<LspProcess>>,
    pub(crate) restart: Mutex<bool>,
}

lazy_static::lazy_static! {
  pub(crate) static ref LSP_SERVERS: Mutex<HashMap<String, Arc<ManagedLspServer>>> = Mutex::new(HashMap::new());
  pub(crate) static ref LSP_STATES: Mutex<HashMap<String, LspServerStatus>> = Mutex::new(HashMap::new());
}

pub(crate) async fn set_state(
    id: &str,
    running: bool,
    error: Option<String>,
    source: Option<String>,
    install_state: Option<String>,
) {
    let mut states = LSP_STATES.lock().await;
    let existing = states.get(id).cloned();
    states.insert(
        id.to_string(),
        LspServerStatus {
            id: id.to_string(),
            running,
            error,
            source: source.or(existing.as_ref().and_then(|s| s.source.clone())),
            install_state: install_state
                .or(existing.as_ref().and_then(|s| s.install_state.clone())),
        },
    );
}

async fn stderr_snapshot(process: &Mutex<LspProcess>) -> String {
    let tail = {
        let guard = process.lock().await;
        guard.stderr_tail.clone()
    };
    let text = tail.lock().await.clone();
    text
}

async fn clear_pending(process: &Mutex<LspProcess>, id: u64) {
    let guard = process.lock().await;
    guard.pending.lock().await.remove(&id);
}

pub(crate) async fn cancel_pending_requests(process: &Mutex<LspProcess>, reason: &str) -> String {
    let stderr = stderr_snapshot(process).await;
    let message = append_stderr_snippet(reason.to_string(), &stderr);
    let senders: Vec<_> = {
        let guard = process.lock().await;
        let mut pending = guard.pending.lock().await;
        pending.drain().map(|(_, sender)| sender).collect()
    };
    let payload = serde_json::json!({ "error": { "message": message } });
    for sender in senders {
        let _ = sender.send(payload.clone());
    }
    message
}

async fn wait_until_child_exits(process: &Mutex<LspProcess>) {
    loop {
        {
            let mut guard = process.lock().await;
            match guard.child.try_wait() {
                Ok(Some(_)) => return,
                Ok(None) => {}
                Err(_) => return,
            }
        }
        sleep(Duration::from_millis(50)).await;
    }
}

async fn wait_for_rpc_response(
    process: &Mutex<LspProcess>,
    rx: oneshot::Receiver<serde_json::Value>,
    id: u64,
    method: &str,
    timeout_secs: u64,
) -> Result<serde_json::Value, String> {
    tokio::select! {
        biased;
        result = rx => match result {
            Ok(response) => Ok(response),
            Err(_) => {
                let stderr = stderr_snapshot(process).await;
                Err(append_stderr_snippet(
                    "LSP request cancelled".to_string(),
                    &stderr,
                ))
            }
        },
        _ = wait_until_child_exits(process) => {
            clear_pending(process, id).await;
            let stderr = stderr_snapshot(process).await;
            Err(append_stderr_snippet(
                format!("Language server exited while waiting for {method}"),
                &stderr,
            ))
        },
        _ = sleep(Duration::from_secs(timeout_secs)) => {
            clear_pending(process, id).await;
            let stderr = stderr_snapshot(process).await;
            Err(append_stderr_snippet(
                lsp_request_timeout_error(timeout_secs, method),
                &stderr,
            ))
        }
    }
}

pub(crate) async fn write_lsp_message(
    stdin: &mut ChildStdin,
    body: &serde_json::Value,
) -> Result<(), String> {
    let bytes = serde_json::to_vec(body).map_err(|error| error.to_string())?;
    let header = format!("Content-Length: {}\r\n\r\n", bytes.len());
    let timeout_message = format!("LSP write timed out after {}s", LSP_WRITE_TIMEOUT.as_secs());
    with_timeout(
        LSP_WRITE_TIMEOUT,
        async {
            stdin
                .write_all(header.as_bytes())
                .await
                .map_err(|error| error.to_string())?;
            stdin
                .write_all(&bytes)
                .await
                .map_err(|error| error.to_string())?;
            stdin.flush().await.map_err(|error| error.to_string())
        },
        &timeout_message,
    )
    .await
}

pub(crate) async fn send_notification(
    process: &Mutex<LspProcess>,
    method: &str,
    params: serde_json::Value,
) -> Result<(), String> {
    let message = serde_json::json!({
      "jsonrpc": "2.0",
      "method": method,
      "params": params,
    });

    let mut guard = process.lock().await;
    write_lsp_message(&mut guard.stdin, &message).await
}

pub(crate) async fn json_rpc_request(
    process: &Mutex<LspProcess>,
    method: &str,
    params: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let timeout_secs = match method {
        "textDocument/hover"
        | "textDocument/definition"
        | "textDocument/references"
        | "textDocument/completion"
        | "textDocument/documentSymbol"
        | "workspace/symbol" => 12u64,
        "workspace/diagnostic" => 60u64,
        _ => 30u64,
    };

    let id = {
        let guard = process.lock().await;
        let mut next = guard.next_id.lock().await;
        *next += 1;
        *next
    };

    let (tx, rx) = oneshot::channel();
    {
        let guard = process.lock().await;
        guard.pending.lock().await.insert(id, tx);
    }

    let message = serde_json::json!({
      "jsonrpc": "2.0",
      "id": id,
      "method": method,
      "params": params,
    });

    {
        let mut guard = process.lock().await;
        if let Err(error) = write_lsp_message(&mut guard.stdin, &message).await {
            guard.pending.lock().await.remove(&id);
            let tail = guard.stderr_tail.clone();
            drop(guard);
            let stderr = tail.lock().await.clone();
            return Err(append_stderr_snippet(error, &stderr));
        }
    }

    let response = wait_for_rpc_response(process, rx, id, method, timeout_secs).await?;

    if let Some(error) = response.get("error") {
        let message = error
            .get("message")
            .and_then(|value| value.as_str())
            .unwrap_or("LSP request failed");
        let code = error
            .get("code")
            .and_then(|value| value.as_i64())
            .map(|code| format!(" (code {code})"))
            .unwrap_or_default();
        return Err(format!("{message}{code}"));
    }

    Ok(response
        .get("result")
        .cloned()
        .unwrap_or(serde_json::Value::Null))
}

pub(crate) async fn respond_to_server_request(
    process: &Mutex<LspProcess>,
    id: &serde_json::Value,
    result: serde_json::Value,
) -> Result<(), String> {
    let message = serde_json::json!({
      "jsonrpc": "2.0",
      "id": id,
      "result": result,
    });
    let mut guard = process.lock().await;
    write_lsp_message(&mut guard.stdin, &message).await
}

pub(crate) fn spawn_keepalive(server_id: String, process: Arc<Mutex<LspProcess>>) {
    tokio::spawn(async move {
        loop {
            sleep(Duration::from_secs(5)).await;
            let exited = {
                let mut guard = process.lock().await;
                match guard.child.try_wait() {
                    Ok(Some(_)) => true,
                    Ok(None) => false,
                    Err(_) => true,
                }
            };

            if exited {
                set_state(
                    &server_id,
                    false,
                    Some("Language server crashed".to_string()),
                    None,
                    Some("crashed".to_string()),
                )
                .await;
                let servers = LSP_SERVERS.lock().await;
                if let Some(managed) = servers.get(&server_id) {
                    let mut restart = managed.restart.lock().await;
                    *restart = true;
                }
                break;
            }
        }
    });
}
