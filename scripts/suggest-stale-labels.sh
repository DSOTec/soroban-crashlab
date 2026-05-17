#!/usr/bin/env bash
# scripts/suggest-stale-labels.sh
# Propose stale labels based on inactivity and blockers without mutating issues by default.

set -euo pipefail

REPO="${REPO:-SorobanCrashLab/soroban-crashlab}"
STALE_DAYS="${STALE_DAYS:-3}"
DRY_RUN="${DRY_RUN:-1}" # Default to dry-run (no mutation)

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) REPO="$2"; shift 2 ;;
    --apply) DRY_RUN=0; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

if date --version &>/dev/null 2>&1; then
  STALE_DATE=$(date -d "${STALE_DAYS} days ago" +%Y-%m-%dT%H:%M:%SZ)
else
  STALE_DATE=$(date -v-"${STALE_DAYS}"d +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$(date +%Y-%m-%dT%H:%M:%SZ)" -v-"${STALE_DAYS}"d +%Y-%m-%dT%H:%M:%SZ)
fi

echo "Suggesting 'stale' label for issues inactive since ${STALE_DATE} in ${REPO}..."

# Find open issues that are not already stale, and updated before STALE_DATE
ISSUES=$(gh issue list -R "$REPO" --state open --search "-label:stale updated:<${STALE_DATE}" --json number,title,updatedAt --jq '.[] | [.number, .updatedAt, .title] | @tsv' || true)

if [[ -z "$ISSUES" ]]; then
  echo "No stale issues found."
  exit 0
fi

while IFS=$'\t' read -r NUMBER UPDATED TITLE; do
  echo "[Issue #${NUMBER}] Last updated: ${UPDATED} - ${TITLE}"
  if [[ "$DRY_RUN" -eq 0 ]]; then
    echo "  Applying 'stale' label..."
    gh issue edit "$NUMBER" -R "$REPO" --add-label "stale"
  else
    echo "  (Dry-run) Would apply 'stale' label."
  fi
done <<< "$ISSUES"
