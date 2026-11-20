#!/usr/bin/env bash
# ==============================================================================
# UniShare — Linux / macOS Quick Launch Script
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================================================"
echo "          UniShare University Academic Resource Sharing Demo            "
echo "========================================================================"
echo "Starting local demo setup on Linux/macOS..."
echo ""

# 1. Check prerequisites
if ! command -v python3 &>/dev/null; then
    echo "[ERROR] Python 3 is required but not installed or not in PATH."
    exit 1
fi

if ! command -v node &>/dev/null; then
    echo "[ERROR] Node.js is required but not installed or not in PATH."
    exit 1
fi

if ! command -v npm &>/dev/null; then
    echo "[ERROR] npm is required but not installed or not in PATH."
    exit 1
fi

PYTHON_VER=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
NODE_VER=$(node -v)
echo "[INFO] Detected Python $PYTHON_VER and Node.js $NODE_VER."

# 2. Setup backend virtual environment
VENV_DIR="$SCRIPT_DIR/backend/.venv"
if [ ! -d "$VENV_DIR" ]; then
    echo "[INFO] Creating Python virtual environment in backend/.venv..."
    python3 -m venv "$VENV_DIR"
    echo "[INFO] Installing backend dependencies from requirements.txt..."
    "$VENV_DIR/bin/pip" install --upgrade pip
    "$VENV_DIR/bin/pip" install -r "$SCRIPT_DIR/backend/requirements.txt"
else
    echo "[INFO] Python virtual environment found."
fi

# 3. Setup frontend dependencies
if [ ! -d "$SCRIPT_DIR/frontend/node_modules" ]; then
    echo "[INFO] Installing frontend dependencies (npm install)..."
    (cd "$SCRIPT_DIR/frontend" && npm install)
else
    echo "[INFO] Frontend node_modules found."
fi

# 4. Verify / seed local SQLite database & demo storage
mkdir -p "$SCRIPT_DIR/backend/storage/uploads"
mkdir -p "$SCRIPT_DIR/backend/storage/submissions"

if [ ! -f "$SCRIPT_DIR/backend/unishare.db" ]; then
    echo "[INFO] Initializing demo SQLite database and sample academic PDFs..."
    "$VENV_DIR/bin/python" "$SCRIPT_DIR/backend/scripts/seed.py"
else
    echo "[INFO] Existing local database found."
fi

# 5. Launch Backend & Frontend
echo ""
echo "[INFO] Launching FastAPI Backend on http://127.0.0.1:8000..."
"$VENV_DIR/bin/python" -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

cleanup() {
    echo ""
    echo "[INFO] Stopping UniShare demo processes..."
    kill $BACKEND_PID 2>/dev/null || true
    echo "[INFO] Shutdown complete."
}
trap cleanup EXIT INT TERM

# Wait for backend health check
echo "[INFO] Waiting for backend to initialize..."
for i in {1..30}; do
    if curl -s http://127.0.0.1:8000/api/health | grep -q '"status":"ok"' 2>/dev/null; then
        echo "[PASS] Backend is online and healthy."
        break
    fi
    sleep 0.5
done

# Try opening default browser
if command -v xdg-open &>/dev/null; then
    xdg-open "http://localhost:5173" 2>/dev/null || true
elif command -v open &>/dev/null; then
    open "http://localhost:5173" 2>/dev/null || true
fi

echo ""
echo "========================================================================"
echo "  UniShare is running!"
echo "  - Web App:      http://localhost:5173"
echo "  - API Docs:     http://127.0.0.1:8000/docs"
echo "  - Storage:      Local Filesystem (backend/storage/uploads)"
echo "  - Database:     Local SQLite (backend/unishare.db)"
echo "========================================================================"
echo "Press Ctrl+C to stop both backend and frontend."
echo ""

cd "$SCRIPT_DIR/frontend"
npm run dev -- --host 127.0.0.1 --port 5173
