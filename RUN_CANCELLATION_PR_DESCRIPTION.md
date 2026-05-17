# chore: Add run cancellation command validation and runtime cancellation guarantees

Closes #426

## Summary

This change completes the run-cancellation issue scope by hardening cooperative cancellation timing for partitioned runs and adding focused coverage for both runtime and CLI surfaces.

## What changed

- Fixed cancellation timing in `drive_run` so cancellation is checked at each global seed boundary before worker-partition ownership filtering.
- Added a focused regression test proving partitioned `drive_run` observes cancellation at the global terminal point (`cancelled_at_seed = Some(0)` when cancellation is already requested).
- Added a focused failure-path test proving `drive_run` returns `RunTerminalState::Failed` with the original error message.
- Added integration tests for `crashlab run cancel <id>`:
  - acceptance path: command succeeds and creates the cancel marker under `CRASHLAB_STATE_DIR`
  - edge path: invalid run id fails with an explicit validation error

## Why this is safe

- Compatibility is preserved with replay and bundle persistence because cancellation still uses the same on-disk marker path and public APIs.
- Health reporting compatibility is preserved because terminal run states and partial summaries remain unchanged in shape (`Completed`, `Cancelled`, `Failed` with `RunSummary`).
- Scope is limited to cancellation behavior and tests; no new abstractions were introduced.

## Validation

Primary:

cargo test --all-targets

Suggested execution:

cd contracts/crashlab-core
cargo test --all-targets

Secondary (affected module checks):

cd contracts/crashlab-core
cargo test run_control
cargo test --test run_cancel_cli

Expected outcomes:

- Run cancellation remains terminal and deterministic for global seed ordering in partitioned and non-partitioned runs.
- Partial summary fields are preserved and test-asserted.
- CLI `run cancel` command acceptance and invalid-input failure behavior both pass.

## Local output summary

- Source edits and diagnostics completed with no Rust analysis errors in impacted files.
- Full shell test execution could not be run in this session due a workspace terminal provider error (`ENOPRO`), so maintainer validation commands are included above for reproducible verification.
