#!/bin/bash
set -e

echo "Starting setup..."

if [ ! -d "node_modules" ] || [ ! -d "venv" ]; then
    echo "Dependencies missing. Running install.sh..."
    bash install.sh
else
    echo "Dependencies already installed."
fi

echo "Building project..."
npm run build

echo "Setup complete!"
