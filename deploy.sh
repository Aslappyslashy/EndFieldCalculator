#!/bin/bash
set -e

echo "Deploying Endfield Industrial Calculator..."

echo "1. Installing/Updating dependencies..."
bash install.sh

echo "2. Building frontend..."
npm run build

echo "3. Production build ready in 'dist' directory."
echo "   To run the backend, use: source venv/bin/activate && python main.py"
echo "   To serve the frontend, use: npm run preview"

echo "Deployment preparation complete!"
