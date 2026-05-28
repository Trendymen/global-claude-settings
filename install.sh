#!/usr/bin/env bash
# Unix/macOS wrapper. The real restore implementation is cross-platform Node.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/install.mjs" "$@"
