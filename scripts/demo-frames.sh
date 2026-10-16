#!/usr/bin/env bash
# Runs scripts/demo/frames.test.ts against the real runtime on a temporary copy of context-receipt.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
cp -r "$root/plugins/context-receipt" "$tmp/"
rm -f "$tmp/context-receipt/tests/"*.ts
cp "$root/scripts/demo/frames.test.ts" "$tmp/context-receipt/tests/"
claude plugin test "$tmp/context-receipt" 2>&1 | grep -E '^(FRAME|RECEIPT)'
