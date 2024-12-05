#!/bin/bash

# Check if service path and Python file arguments are provided
if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: $0 <service_path> <python_file>"
  exit 1
fi

SERVICE_PATH=$1
PYTHON_FILE=$2
VENV_DIR="$SERVICE_PATH/venv"

# Step (a) Check if the virtual environment exists
if [ ! -f "$VENV_DIR/bin/activate" ]; then
  echo ">> Virtual environment not found. Please install dependencies by running 'npm run python:install' <<"
  exit 1
fi

# Step (b) Check if the Python file exists
if [ ! -f "$PYTHON_FILE" ]; then
  echo ">> Python file '$PYTHON_FILE' not found. Please provide a valid file path. <<"
  exit 1
fi

# Step (c) Activate the virtual environment
echo ">> Activating virtual environment <<"
source "$VENV_DIR/bin/activate"

# Step (d) Add the service directory to PYTHONPATH
export PYTHONPATH="$SERVICE_PATH:$PYTHONPATH"

# Step (e) Indicate local execution
export IS_LOCAL="True"

# Step (f) Execute the specified Python file
echo ">> Executing Python file '$PYTHON_FILE' <<"
"$VENV_DIR/bin/python3" "$PYTHON_FILE" || { echo ">> Execution failed <<"; deactivate; exit 1; }

# Step (g) Deactivate the virtual environment
echo ">> Deactivating virtual environment <<"
deactivate
