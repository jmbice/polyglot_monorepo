#!/bin/bash

# Check if service path argument is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <service_path>"
  exit 1
fi

SERVICE_PATH=$1
VENV_DIR="$SERVICE_PATH/venv"

# Create the virtual environment if not found in "venv"
if [ ! -f "$VENV_DIR/bin/activate" ]; then
  echo "Virtual environment not found in $VENV_DIR. Creating a new one..."
  python3 -m venv "$VENV_DIR" || { echo "Failed to create virtual environment."; exit 1; }
fi

# Step (a) Activate the virtual environment
echo "Activating virtual environment in $VENV_DIR..."
source "$VENV_DIR/bin/activate"

# Step (b) Install required packages
echo "Installing required packages in $SERVICE_PATH..."
"$VENV_DIR/bin/pip3" install -r "$SERVICE_PATH/requirements.txt" || { echo "Failed to install packages."; deactivate; exit 1; }

# Step (c) Deactivate the virtual environment
echo "Deactivating virtual environment..."
deactivate

echo "Virtual environment setup completed for $SERVICE_PATH."
