#!/bin/bash
set -e

echo "Installing Node.js dependencies..."
npm install

echo "Setting up Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

echo "Installing Python dependencies..."
pip install --upgrade pip
pip install fastapi uvicorn pulp highspy pydantic

echo "Installation complete!"
