#!/bin/bash
set -e

echo "Setting up Python backend with virtual environment..."

cd backend

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
  echo "Creating virtual environment..."
  python -m venv .venv
fi

# Run all commands in the virtual environment context
echo "Activating virtual environment and installing dependencies..."
source .venv/bin/activate && \
pip install --upgrade pip && \
pip install -r requirements.txt && \
echo "Python setup complete! Virtual environment is ready." && \
deactivate

echo "✅ Backend setup finished!"
echo "To activate the environment manually: source backend/.venv/bin/activate"
