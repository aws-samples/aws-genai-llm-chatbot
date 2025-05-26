#!/bin/bash
set -e  # Exit immediately if a command exits with a non-zero status
set -u  # Treat unset variables as an error when substituting
set -o pipefail  # Pipeline fails on the first command that fails

# Unified script to prepare for vending and clean up after vending
# Usage: ./vend-prep.sh --pre   # Copy files to module directory
#        ./vend-prep.sh --post  # Remove files from module directory

# Define the source directory (current directory by default)
SOURCE_DIR="$(pwd)"

# Define the target module directory
MODULE_DIR="${SOURCE_DIR}/aws-genai-llm-chatbot/modules/chatbot"

# List of artifacts to copy/remove
ARTIFACTS=(
  "lib"
  "bin"
  "cli"
  ".graphqlconfig.yml"
  "cdk.json"
  "package.json"
  "package-lock.json"
  "tsconfig.json"
)

# Function to show usage
show_usage() {
  echo "Usage: $0 [--pre|--post]"
  echo "  --pre   Copy files to module directory for vending"
  echo "  --post  Remove files from module directory after vending"
  exit 1
}

# Function to prepare for vending (copy files)
pre_vend() {
  npx @aws-amplify/cli codegen --yes
  npx rimraf lib/**/*.js.map
  npx rimraf ./**/node_modules

  # Check if module directory exists
  if [ ! -d "$MODULE_DIR" ]; then
    echo "Module directory does not exist: $MODULE_DIR"
    echo "Creating directory..."
    mkdir -p "$MODULE_DIR"
  fi

  # Copy each artifact
  echo "Copying artifacts to $MODULE_DIR..."
  for artifact in "${ARTIFACTS[@]}"; do
    if [ -e "$SOURCE_DIR/$artifact" ]; then
      echo "  Copying $artifact"
      cp -r "$SOURCE_DIR/$artifact" "$MODULE_DIR/"
    else
      echo "  Warning: $artifact not found in $SOURCE_DIR"
    fi
  done

  echo "Pre-vend preparation completed successfully."
}

# Function to clean up after vending (remove files)
post_vend() {
  # Check if module directory exists
  if [ ! -d "$MODULE_DIR" ]; then
    echo "Error: Module directory does not exist: $MODULE_DIR"
    exit 1
  fi

  # Remove each artifact
  echo "Cleaning up artifacts from $MODULE_DIR..."
  for artifact in "${ARTIFACTS[@]}"; do
    if [ -e "$MODULE_DIR/$artifact" ]; then
      echo "  Removing $artifact"
      rm -rf "$MODULE_DIR/$artifact"
    else
      echo "  Note: $artifact not found in $MODULE_DIR"
    fi
  done

  echo "Post-vend cleanup completed successfully."
}

# Check command line arguments
if [ $# -ne 1 ]; then
  show_usage
fi

# Process command line arguments
case "$1" in
  --pre)
    pre_vend
    ;;
  --post)
    post_vend
    ;;
  *)
    show_usage
    ;;
esac

exit 0
