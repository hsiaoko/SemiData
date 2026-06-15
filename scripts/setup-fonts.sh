#!/bin/sh
# 下载 PDF 渲染所需的中文字体 — Adobe Source Han Sans CN
# 字体被 .gitignore 排除，不会进 git 仓库

set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)/public/fonts"
mkdir -p "$DIR"

REG="$DIR/SourceHanSansCN-Regular.otf"
BOLD="$DIR/SourceHanSansCN-Bold.otf"

REG_URL="https://github.com/adobe-fonts/source-han-sans/raw/release/SubsetOTF/CN/SourceHanSansCN-Regular.otf"
BOLD_URL="https://github.com/adobe-fonts/source-han-sans/raw/release/SubsetOTF/CN/SourceHanSansCN-Bold.otf"

download() {
  url="$1"
  out="$2"
  if [ -f "$out" ] && [ "$(wc -c < "$out")" -gt 1000000 ]; then
    echo "  ✓ 已存在 $(basename "$out")"
    return
  fi
  echo "  ↓ 下载 $(basename "$out") ..."
  curl -L --fail --progress-bar -o "$out" "$url" || {
    echo "    ✗ 下载失败：$url" >&2
    echo "    请手动下载该文件并放到 $DIR" >&2
    exit 1
  }
}

echo "→ 字体保存目录：$DIR"
download "$REG_URL" "$REG"
download "$BOLD_URL" "$BOLD"
echo "✓ 字体就绪"
