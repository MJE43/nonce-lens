#!/bin/bash
set -e

# --- Setup Python API ---
cd pump-api/

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

# Activate virtualenv and install dependencies
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate

# --- Setup Frontend ---
cd ../pump-frontend
npm install
