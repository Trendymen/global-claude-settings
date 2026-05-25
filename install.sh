#!/usr/bin/env bash
# Restore ~/.claude/ from this repo (or pull current ~/.claude/ back into the repo).
#
# Usage:
#   bash install.sh                     # default: restore repo -> ~/.claude
#   bash install.sh --no-overwrite      # restore but skip existing files
#   bash install.sh --pull-from-home    # reverse: copy ~/.claude/* back into the repo
#   bash install.sh --dry-run           # show what would happen, don't touch anything
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOTCLAUDE_SRC="$REPO_ROOT/dotclaude"
DOTCLAUDE_DST="$HOME/.claude"
TS="$(date +%Y%m%d-%H%M%S)"

MODE="restore"
NO_OVERWRITE=0
DRY_RUN=0

for arg in "$@"; do
  case "$arg" in
    --pull-from-home) MODE="pull" ;;
    --no-overwrite)   NO_OVERWRITE=1 ;;
    --dry-run)        DRY_RUN=1 ;;
    -h|--help)
      sed -n '2,9p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "未知参数: $arg" >&2; exit 1 ;;
  esac
done

log() { printf '[install] %s\n' "$*"; }
run() {
  if [[ $DRY_RUN -eq 1 ]]; then
    printf '[dry-run] %s\n' "$*"
  else
    eval "$@"
  fi
}

# Files & dirs to sync, relative to dotclaude/ on one side and ~/.claude/ on the other.
ENTRIES=(
  "CLAUDE.md"
  "AGENTS.md"
  "settings.json"
  "settings.local.json"
  "claude-mode.zsh"
  "switch-claude.js"
  "agents"
  "hooks"
  "skills"
  "plugins/installed_plugins.json"
  "plugins/known_marketplaces.json"
)

copy_one() {
  local src="$1" dst="$2"
  if [[ ! -e "$src" ]]; then
    log "跳过（源不存在）: $src"
    return
  fi
  if [[ -e "$dst" ]]; then
    if [[ $NO_OVERWRITE -eq 1 ]]; then
      log "跳过（目标已存在 + --no-overwrite）: $dst"
      return
    fi
    if [[ -f "$dst" ]]; then
      run "cp -p '$dst' '${dst}.before-restore-${TS}'"
      log "备份: $dst -> ${dst}.before-restore-${TS}"
    fi
  fi
  run "mkdir -p '$(dirname "$dst")'"
  if [[ -d "$src" ]]; then
    run "mkdir -p '$dst'"
    run "cp -R '$src/.' '$dst/'"
  else
    run "cp -p '$src' '$dst'"
  fi
  log "已写入: $dst"
}

case "$MODE" in
  restore)
    log "模式: restore (repo -> ~/.claude)"
    run "mkdir -p '$DOTCLAUDE_DST'"
    for entry in "${ENTRIES[@]}"; do
      copy_one "$DOTCLAUDE_SRC/$entry" "$DOTCLAUDE_DST/$entry"
    done

    # 合并 MCP user-scope 到 ~/.claude.json
    if [[ -f "$DOTCLAUDE_SRC/mcp-user-scope.json" ]]; then
      if ! command -v jq >/dev/null 2>&1; then
        log "⚠️  未安装 jq，跳过 MCP 合并；请手动把 dotclaude/mcp-user-scope.json 里 mcpServers 合并到 ~/.claude.json"
      else
        if [[ -f "$HOME/.claude.json" ]]; then
          run "cp -p '$HOME/.claude.json' '$HOME/.claude.json.before-restore-${TS}'"
          log "备份: ~/.claude.json -> ~/.claude.json.before-restore-${TS}"
          if [[ $DRY_RUN -eq 0 ]]; then
            tmp="$(mktemp)"
            jq -s '.[0] * .[1]' "$HOME/.claude.json" "$DOTCLAUDE_SRC/mcp-user-scope.json" > "$tmp"
            mv "$tmp" "$HOME/.claude.json"
          fi
          log "已合并 mcpServers 到 ~/.claude.json"
        else
          run "cp -p '$DOTCLAUDE_SRC/mcp-user-scope.json' '$HOME/.claude.json'"
          log "已初始化 ~/.claude.json"
        fi
      fi
    fi

    # 确保 hooks 可执行
    if [[ -d "$DOTCLAUDE_DST/hooks" ]]; then
      run "chmod +x '$DOTCLAUDE_DST/hooks/'*.sh 2>/dev/null || true"
    fi

    cat <<'EOF'

================================================================
还原完成。后续手动步骤：

1. 在 Claude Code 内安装插件（参考 dotclaude/plugins/installed_plugins.json）：
     /plugin marketplace add anthropics/claude-plugins-official
     /plugin install superpowers@claude-plugins-official
     /plugin install context7@claude-plugins-official
     /plugin install frontend-design@claude-plugins-official
     /plugin install code-review@claude-plugins-official

2. （可选）在 ~/.zshrc 追加 shell 集成：
     [ -f ~/.claude/claude-mode.zsh ] && source ~/.claude/claude-mode.zsh

3. 启动 Claude Code，确认 CLAUDE.md / hooks / statusLine 生效。
================================================================
EOF
    ;;

  pull)
    log "模式: pull (~/.claude -> repo)"
    for entry in "${ENTRIES[@]}"; do
      src="$DOTCLAUDE_DST/$entry"
      dst="$DOTCLAUDE_SRC/$entry"
      if [[ ! -e "$src" ]]; then
        log "跳过（~/.claude 下不存在）: $src"
        continue
      fi
      run "mkdir -p '$(dirname "$dst")'"
      if [[ -d "$src" ]]; then
        # 同步目录，但排除 hooks/*.bak-*
        if [[ "$entry" == "hooks" ]]; then
          run "rm -rf '$dst'"
          run "mkdir -p '$dst'"
          for f in "$src"/*.sh; do
            [[ -e "$f" ]] || continue
            base="$(basename "$f")"
            case "$base" in
              *.bak-*) log "跳过 bak: $base" ;;
              *) run "cp -p '$f' '$dst/'" ;;
            esac
          done
        else
          run "rm -rf '$dst'"
          run "cp -R '$src' '$dst'"
        fi
      else
        run "cp -p '$src' '$dst'"
      fi
      log "已拉回: $dst"
    done

    # 重新抽取 mcpServers
    if command -v jq >/dev/null 2>&1 && [[ -f "$HOME/.claude.json" ]]; then
      if [[ $DRY_RUN -eq 0 ]]; then
        jq '{mcpServers: .mcpServers}' "$HOME/.claude.json" > "$DOTCLAUDE_SRC/mcp-user-scope.json"
      fi
      log "已刷新 mcp-user-scope.json"
    fi

    log "完成。建议接着跑: git -C '$REPO_ROOT' status && git -C '$REPO_ROOT' diff"
    ;;
esac
