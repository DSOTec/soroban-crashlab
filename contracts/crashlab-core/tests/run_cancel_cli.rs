use crashlab_core::{RunId, cancel_marker_path};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

fn unique_tmp() -> PathBuf {
    let n = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("time")
        .as_nanos();
    std::env::temp_dir().join(format!("crashlab-run-cancel-cli-{n}"))
}

#[test]
fn run_cancel_creates_cancel_marker() {
    let base = unique_tmp();
    fs::create_dir_all(&base).expect("create base dir");

    let output = Command::new(env!("CARGO_BIN_EXE_crashlab"))
        .env("CRASHLAB_STATE_DIR", &base)
        .arg("run")
        .arg("cancel")
        .arg("42")
        .output()
        .expect("run crashlab binary");

    assert!(
        output.status.success(),
        "expected success, got status {:?}, stderr: {}",
        output.status,
        String::from_utf8_lossy(&output.stderr)
    );

    let marker = cancel_marker_path(RunId(42), &base);
    assert!(marker.exists(), "expected cancel marker at {}", marker.display());

    let _ = fs::remove_dir_all(&base);
}

#[test]
fn run_cancel_rejects_invalid_run_id() {
    let output = Command::new(env!("CARGO_BIN_EXE_crashlab"))
        .arg("run")
        .arg("cancel")
        .arg("not-a-number")
        .output()
        .expect("run crashlab binary");

    assert!(
        !output.status.success(),
        "expected failure for invalid run id"
    );

    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        stderr.contains("invalid run id"),
        "unexpected stderr: {stderr}"
    );
}
