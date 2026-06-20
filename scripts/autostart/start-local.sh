#!/bin/bash

# Thiết lập PATH để tìm thấy uv, node, npm, surreal
export PATH="/home/i/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

PROJECT_DIR="/home/i/Documents/open-notebook-main (1)/open-notebook-main"
cd "$PROJECT_DIR"

echo "=== Khởi động RAG / Open Notebook (Local Mode) ==="

# 1. Dọn dẹp các tiến trình cũ nếu còn chạy để tránh trùng cổng
echo "Đang kiểm tra và dọn dẹp các tiến trình cũ..."
pkill -f "surreal start" || true
pkill -f "run_api.py" || true
pkill -f "surreal-commands-worker" || true
pkill -f "next-dev" || true
pkill -f "next start" || true
sleep 1

# 2. Khởi động SurrealDB
echo "Đang khởi động SurrealDB..."
surreal start --user root --pass root rocksdb://surreal_data --bind 127.0.0.1:8000 > surrealdb_daemon.log 2>&1 &
SURREAL_PID=$!

# Chờ database sẵn sàng (thử kết nối tối đa 10 giây)
echo "Đang chờ SurrealDB sẵn sàng..."
for i in {1..10}; do
    if curl -s http://127.0.0.1:8000/health > /dev/null; then
        echo "✓ SurrealDB đã sẵn sàng."
        break
    fi
    sleep 1
done

# 3. Khởi động API backend
echo "Đang khởi động API backend..."
uv run --env-file .env run_api.py > api_daemon.log 2>&1 &
API_PID=$!

# Chờ API sẵn sàng (thử kết nối tối đa 10 giây)
echo "Đang chờ API backend sẵn sàng..."
for i in {1..10}; do
    if curl -s http://127.0.0.1:5055/health > /dev/null; then
        echo "✓ API backend đã sẵn sàng."
        break
    fi
    sleep 1
done

# 4. Khởi động background worker
echo "Đang khởi động background worker..."
uv run --env-file .env surreal-commands-worker --import-modules commands > worker_daemon.log 2>&1 &
WORKER_PID=$!

# 5. Khởi động Next.js frontend (chạy ở foreground để systemd theo dõi trực tiếp)
echo "Đang khởi động Next.js frontend..."
cd frontend
exec npm run dev
