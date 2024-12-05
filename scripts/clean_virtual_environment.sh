#!/bin/bash

# Check if service path argument is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <service_path>"
  exit 1
fi

SERVICE_PATH=$1
VENV_DIR="$SERVICE_PATH/venv"

# Step (a) Clean up __pycache__ and other generated items
echo "Cleaning up generated files in $SERVICE_PATH..."
find "$SERVICE_PATH" -type d -name "__pycache__" -exec rm -rf {} +
find "$SERVICE_PATH" -type f -name "*.pyc" -delete
find "$SERVICE_PATH" -type f -name "*.pyo" -delete

# Step (b) Remove pyvenv.cfg if it exists in the venv directory
if [ -f "$SERVICE_PATH/pyvenv.cfg" ]; then
  echo "Removing pyvenv.cfg from $SERVICE_PATH..."
  rm -f "$SERVICE_PATH/pyvenv.cfg"
fi

# Step (c) Remove the venv directory
if [[ -d "$VENV_DIR" ]]; then
  echo "Removing virtual environment at $VENV_DIR..."
  rm -rf "$VENV_DIR"
fi

echo "Cleanup completed for $SERVICE_PATH."
