#!/usr/bin/env bash
# 网约车物语 — 本地启动器（macOS / Linux）
# 双击此文件即可:启动 HTTP 服务器 + 自动打开浏览器
# 关闭 Terminal 窗口或按 Ctrl+C 即可停止服务器

cd "$(dirname "$0")" || exit 1

PORT="${WYCWY_PORT:-8765}"
HTML_FILE="网约车物语-V3.html"
URL="http://localhost:${PORT}/${HTML_FILE}"

# 1. 选服务器运行时:Node 支持 AI 复盘接口;没有 Node 时退回 Python 静态服务
if command -v node >/dev/null 2>&1; then
  SERVER_KIND="Node"
  SERVER_CMD=(node scripts/ai-review-server.mjs)
elif command -v python3 >/dev/null 2>&1; then
  SERVER_KIND="Python"
  SERVER_CMD=(python3 -m http.server "$PORT")
elif command -v python >/dev/null 2>&1; then
  SERVER_KIND="Python"
  SERVER_CMD=(python -m http.server "$PORT")
else
  echo "❌ 找不到 Node 或 Python,无法启动本地服务器。"
  echo ""
  echo "macOS 安装方式:"
  echo "  Node:   brew install node"
  echo "  Python: brew install python"
  echo ""
  read -r -p "按回车关闭..."
  exit 1
fi

# 2. 检查端口是否被占用
if lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "⚠️  端口 ${PORT} 已被占用,可能是上次启动的服务器没关。"
  echo "    试试访问 ${URL} 看是不是已经能玩;或者关闭占用进程后再重试。"
  echo ""
  read -r -p "按回车继续启动浏览器..."
  case "$(uname -s)" in
    Darwin)  open "$URL" ;;
    Linux)   xdg-open "$URL" 2>/dev/null || true ;;
  esac
  exit 0
fi

echo "==================================="
echo "  网约车物语 — 本地启动"
echo "==================================="
echo ""
echo "🚀 启动 ${SERVER_KIND} HTTP 服务器(端口 ${PORT})..."

# 3. 后台起服务器
PORT="$PORT" "${SERVER_CMD[@]}" >/dev/null 2>&1 &
SERVER_PID=$!

# 4. Ctrl+C / 关窗 / 退出时清理服务器进程
cleanup() {
  echo ""
  echo "🛑 关闭服务器(PID ${SERVER_PID})..."
  kill "$SERVER_PID" 2>/dev/null
  exit 0
}
trap cleanup INT TERM EXIT

# 5. 等服务器起来
sleep 1

# 6. 自动开浏览器
case "$(uname -s)" in
  Darwin) open "$URL" ;;
  Linux)  xdg-open "$URL" 2>/dev/null || echo "请手动打开: $URL" ;;
  *)      echo "请手动打开: $URL" ;;
esac

echo ""
echo "✓ 游戏已启动: ${URL}"
echo "✓ 关闭此窗口或按 Ctrl+C 即可停止服务器"
echo ""

# 7. 保持脚本运行,等服务器进程退出
wait "$SERVER_PID"
