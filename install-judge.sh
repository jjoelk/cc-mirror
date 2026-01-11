#!/bin/bash
# Install judge command to ~/.local/bin

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
JUDGE_PATH="$SCRIPT_DIR/judge.py"
BIN_DIR="$HOME/.local/bin"
WRAPPER="$BIN_DIR/judge"

# Create bin directory if needed
mkdir -p "$BIN_DIR"

# Install rich for beautiful output (optional but recommended)
echo "Installing rich for beautiful terminal output..."
pip3 install rich --quiet 2>/dev/null || pip install rich --quiet 2>/dev/null || echo "Note: Could not install rich. Output will still work but be less pretty."

# Create wrapper script
cat > "$WRAPPER" << EOF
#!/bin/bash
python3 "$JUDGE_PATH" "\$@"
EOF

chmod +x "$WRAPPER"

echo ""
echo "Installed: $WRAPPER"
echo ""
echo "Make sure ~/.local/bin is in your PATH:"
echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
echo ""
echo "Usage:"
echo "  judge \"how does auth work?\""
echo "  judge --list"
echo "  judge --clean"
