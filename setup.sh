#!/bin/bash
set -e

echo "Setting up Nonce Lens project..."

# --- Setup Python API ---
./setup_python.sh


# --- Setup Frontend ---
echo "Setting up frontend..."
cd frontend
echo "Installing npm dependencies..."
npm install

echo "Setup complete! 🎉"
echo "To start the backend: cd backend && source .venv/bin/activate && python start_server.py"
echo "To start the frontend: cd frontend && npm start"
