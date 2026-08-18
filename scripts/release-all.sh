#!/usr/bin/env bash
# P2-04：仓库级一键发布门禁 = 后端 check + 前端生产 gate（含 E2E）
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> [1/2] backend check（typecheck + data + golden + replay 抽取 + tests + build）"
(cd backend && npm run check)

echo "==> [2/2] frontend release gate（build + labels + 自起 backend+preview 的生产 Golden Flow，不依赖任何在运行的服务）"
(cd frontend && npm run release:gate)

echo "release-all: PASS"
