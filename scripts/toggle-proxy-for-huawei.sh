#!/bin/bash

# 用法：
#   ./toggle-proxy-for-huawei.sh off   # 关闭代理，用于登录华为云
#   ./toggle-proxy-for-huawei.sh on    # 恢复之前保存的代理
#
# 如果你的网络接口不是 Wi-Fi，可以修改 INTERFACE 变量，或作为第二个参数传入：
#   ./toggle-proxy-for-huawei.sh off "USB 10/100/1000 LAN"

INTERFACE="${2:-Wi-Fi}"
STATE_FILE="$HOME/.huawei_proxy_state"

usage() {
  echo "用法: $0 off [接口名]   # 关闭系统代理，登录华为云"
  echo "       $0 on  [接口名]   # 恢复之前保存的代理"
  exit 1
}

get_proxy_field() {
  local output=$1
  local key=$2
  echo "$output" | awk -v k="$key:" '/^[A-Za-z]+:/{if ($1 == k) {print $2}}'
}

save_and_disable() {
  echo "当前网络接口: $INTERFACE"

  web=$(networksetup -getwebproxy "$INTERFACE")
  secure=$(networksetup -getsecurewebproxy "$INTERFACE")
  socks=$(networksetup -getsocksfirewallproxy "$INTERFACE")

  web_enabled=$(get_proxy_field "$web" "Enabled")
  web_server=$(get_proxy_field "$web" "Server")
  web_port=$(get_proxy_field "$web" "Port")

  secure_enabled=$(get_proxy_field "$secure" "Enabled")
  secure_server=$(get_proxy_field "$secure" "Server")
  secure_port=$(get_proxy_field "$secure" "Port")

  socks_enabled=$(get_proxy_field "$socks" "Enabled")
  socks_server=$(get_proxy_field "$socks" "Server")
  socks_port=$(get_proxy_field "$socks" "Port")

  cat > "$STATE_FILE" <<EOF
WEB_ENABLED=$web_enabled
WEB_SERVER=$web_server
WEB_PORT=$web_port
SECURE_ENABLED=$secure_enabled
SECURE_SERVER=$secure_server
SECURE_PORT=$secure_port
SOCKS_ENABLED=$socks_enabled
SOCKS_SERVER=$socks_server
SOCKS_PORT=$socks_port
EOF

  echo "已保存代理配置到 $STATE_FILE："
  cat "$STATE_FILE"
  echo ""

  networksetup -setwebproxystate "$INTERFACE" off
  networksetup -setsecurewebproxystate "$INTERFACE" off
  networksetup -setsocksfirewallproxystate "$INTERFACE" off

  echo "✅ 系统代理已关闭，现在可以直接访问/登录华为云了。"
  echo "   登录完成后，运行：$0 on"
}

restore() {
  if [[ ! -f "$STATE_FILE" ]]; then
    echo "❌ 没有找到代理备份 $STATE_FILE，无法恢复。"
    echo "   请手动在 系统设置 > 网络 > 代理 里重新配置。"
    exit 1
  fi

  # shellcheck source=/dev/null
  source "$STATE_FILE"

  if [[ "$WEB_ENABLED" == "Yes" && -n "$WEB_SERVER" && -n "$WEB_PORT" ]]; then
    networksetup -setwebproxy "$INTERFACE" "$WEB_SERVER" "$WEB_PORT"
    networksetup -setwebproxystate "$INTERFACE" on
    echo "✅ HTTP 代理已恢复：$WEB_SERVER:$WEB_PORT"
  fi

  if [[ "$SECURE_ENABLED" == "Yes" && -n "$SECURE_SERVER" && -n "$SECURE_PORT" ]]; then
    networksetup -setsecurewebproxy "$INTERFACE" "$SECURE_SERVER" "$SECURE_PORT"
    networksetup -setsecurewebproxystate "$INTERFACE" on
    echo "✅ HTTPS 代理已恢复：$SECURE_SERVER:$SECURE_PORT"
  fi

  if [[ "$SOCKS_ENABLED" == "Yes" && -n "$SOCKS_SERVER" && -n "$SOCKS_PORT" ]]; then
    networksetup -setsocksfirewallproxy "$INTERFACE" "$SOCKS_SERVER" "$SOCKS_PORT"
    networksetup -setsocksfirewallproxystate "$INTERFACE" on
    echo "✅ SOCKS 代理已恢复：$SOCKS_SERVER:$SOCKS_PORT"
  fi

  echo "✅ 系统代理已恢复到关闭前的状态。"
}

case "$1" in
  off) save_and_disable ;;
  on)  restore ;;
  *)   usage ;;
esac
