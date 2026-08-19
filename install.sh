#!/usr/bin/env bash
# Codex 安装器的 Unix/macOS Node 入口包装器。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/install.mjs" "$@"
