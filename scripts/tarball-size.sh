#!/bin/bash
# tarball-size.sh - Script to create a tarball and analyze its size
# This implements suggestion #9 from the tarball size reduction plan

set -e  # Exit immediately if a command exits with a non-zero status

# Print header
echo "===== Tarball Size Analysis ====="
echo "Creating tarball with npm pack..."

# Create the package without publishing
npm pack

# Get the name of the created tarball (should be the only .tgz file)
TARBALL=$(ls -t *.tgz | head -1)

if [ -z "$TARBALL" ]; then
    echo "Error: No tarball was created"
    exit 1
fi

echo -e "\n===== Tarball Information ====="
echo "Tarball name: $TARBALL"

# Check the size
echo -e "\n===== Size Information ====="
du -h "$TARBALL"

# Get total size in bytes for more precise comparison (macOS compatible)
BYTES=$(stat -f %z "$TARBALL" 2>/dev/null || stat --format=%s "$TARBALL" 2>/dev/null)
echo "Size in bytes: $BYTES"

# Create a temporary directory for extraction
TEMP_DIR=$(mktemp -d)
echo -e "\n===== Extracting to $TEMP_DIR ====="

# Extract the tarball
tar -xzf "$TARBALL" -C "$TEMP_DIR"

# Show the largest files/directories
echo -e "\n===== 20 Largest Files/Directories ====="
find "$TEMP_DIR" -type f -exec du -h {} \; | sort -hr | head -20

# Show directory sizes
echo -e "\n===== Directory Sizes ====="
find "$TEMP_DIR" -type d -depth 2 -exec du -sh {} \; | sort -hr | head -10

# Count files by extension
echo -e "\n===== Files by Extension ====="
find "$TEMP_DIR" -type f | grep -v "node_modules" | sed 's/.*\.//' | sort | uniq -c | sort -nr | head -10

# Clean up
echo -e "\n===== Cleaning Up ====="
rm -rf "$TEMP_DIR"
echo "Temporary directory removed"

echo -e "\n===== Recommendations ====="
echo "Consider the following to reduce tarball size:"
echo "1. Add large files/directories to .npmignore"
echo "2. Use the 'files' field in package.json to include only necessary files"
echo "3. Remove development dependencies before packaging"
echo "4. Compress images and other assets"
echo "5. Remove source maps and debug files"

echo -e "\nAnalysis complete!"
