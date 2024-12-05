#!/bin/bash

# Check if service path argument is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <service_path>"
  exit 1
fi

SERVICE_PATH=$1
VENV_DIR="$SERVICE_PATH/venv"

# Step (a) Check if the virtual environment exists
if [ ! -f "$VENV_DIR/bin/activate" ]; then
  echo ">> Virtual environment not found. Please install dependencies by running 'npm run python:install' <<'"
  exit 1
fi

# Step (b) Activate the virtual environment
echo ">> Activating virtual environment <<"
source "$VENV_DIR/bin/activate"

# Step (c) Add the service directory to PYTHONPATH
export PYTHONPATH="$SERVICE_PATH:$PYTHONPATH"

# Step (d) Execute unit tests with unittest
echo ">> Testing Starts Here <<"
"$VENV_DIR/bin/python3" -m unittest discover -s "$SERVICE_PATH/tests" || { echo ">> Unit tests not found or failed <<"; deactivate; exit 1; }

echo ">> Tests Ends Here <<"

# Step (e) Deactivate the virtual environment
echo ">> Deactivating virtual environment <<"
deactivate

