#!/usr/bin/env bash
# macOS / Linux 一键启动：检查 .env → 装依赖 → 启动后端 → 打开控制台
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend-node"
DEMO_URL="http://localhost:3010/demo/"

info() { printf '\033[36m[demo]\033[0m %s\n' "$1"; }
warn() { printf '\033[33m[demo]\033[0m %s\n' "$1"; }
die() {
  printf '\033[31m[demo]\033[0m %s\n' "$1" >&2
  exit 1
}

command -v node >/dev/null 2>&1 || die '缺少 node（需要 >= 18）'
command -v npm >/dev/null 2>&1 || die '缺少 npm'

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || die "Node 版本过低（当前 $NODE_MAJOR，需要 >= 18）"

if [ ! -f "$BACKEND_DIR/.env" ]; then
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  warn "已从 .env.example 生成 backend-node/.env，请填入真实的 SIGHT_REPORT_* 值后重新运行。"
  exit 1
fi

if grep -q 'replace-with-real-secret' "$BACKEND_DIR/.env"; then
  warn 'backend-node/.env 里的 SIGHT_REPORT_APP_SECRET 还是占位值，请先填写真实密钥。'
  exit 1
fi

if [ ! -d "$BACKEND_DIR/node_modules" ]; then
  info '安装依赖…'
  (cd "$BACKEND_DIR" && npm install)
fi

info "启动后端，控制台地址：$DEMO_URL"
(
  sleep 2
  if command -v open >/dev/null 2>&1; then
    open "$DEMO_URL"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$DEMO_URL"
  fi
) >/dev/null 2>&1 &

cd "$BACKEND_DIR"
exec npm start
