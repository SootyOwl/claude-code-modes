#!/bin/sh
set -e

# Install claude-mode from the latest GitHub release.
# Usage: curl -fsSL https://raw.githubusercontent.com/nklisch/claude-code-modes/main/install.sh | sh
#
# Override install directory:
#   CLAUDE_MODE_INSTALL=/usr/local/bin sh install.sh

REPO="nklisch/claude-code-modes"
BINARY="claude-mode"

# ---------------------------------------------------------------------------
# Detect OS
# ---------------------------------------------------------------------------

OS="$(uname -s)"
case "$OS" in
  Linux)  os="linux" ;;
  Darwin) os="darwin" ;;
  *)
    echo "Unsupported OS: $OS" >&2
    echo "claude-mode supports Linux and macOS." >&2
    exit 1
    ;;
esac

# ---------------------------------------------------------------------------
# Detect arch
# ---------------------------------------------------------------------------

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64)          arch="x64" ;;
  aarch64|arm64)   arch="arm64" ;;
  *)
    echo "Unsupported architecture: $ARCH" >&2
    echo "claude-mode supports x86_64 and arm64." >&2
    exit 1
    ;;
esac

# ---------------------------------------------------------------------------
# Fetch latest release tag
# ---------------------------------------------------------------------------

echo "Fetching latest release..."

API_URL="https://api.github.com/repos/${REPO}/releases/latest"

if command -v curl > /dev/null 2>&1; then
  TAG="$(curl -fsSL "$API_URL" | grep '"tag_name"' | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')"
elif command -v wget > /dev/null 2>&1; then
  TAG="$(wget -qO- "$API_URL" | grep '"tag_name"' | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')"
else
  echo "Neither curl nor wget is available. Please install one and retry." >&2
  exit 1
fi

if [ -z "$TAG" ]; then
  echo "Failed to determine the latest release tag." >&2
  exit 1
fi

echo "Latest release: $TAG"

# ---------------------------------------------------------------------------
# Download binary
# ---------------------------------------------------------------------------

ARTIFACT="${BINARY}-${os}-${arch}"
DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${TAG}/${ARTIFACT}"

INSTALL_DIR="${CLAUDE_MODE_INSTALL:-$HOME/.local/bin}"
INSTALL_PATH="${INSTALL_DIR}/${BINARY}"

echo "Downloading ${ARTIFACT}..."

mkdir -p "$INSTALL_DIR"

if command -v curl > /dev/null 2>&1; then
  curl -fsSL "$DOWNLOAD_URL" -o "$INSTALL_PATH"
else
  wget -qO "$INSTALL_PATH" "$DOWNLOAD_URL"
fi

# ---------------------------------------------------------------------------
# Install
# ---------------------------------------------------------------------------

chmod +x "$INSTALL_PATH"

# macOS: remove quarantine attribute (best-effort, may not be present)
if [ "$os" = "darwin" ]; then
  xattr -d com.apple.quarantine "$INSTALL_PATH" 2>/dev/null || true
fi

echo "Installed ${BINARY} to ${INSTALL_PATH}"

# ---------------------------------------------------------------------------
# PATH check
# ---------------------------------------------------------------------------

case ":$PATH:" in
  *":${INSTALL_DIR}:"*)
    # Already in PATH — nothing to print
    ;;
  *)
    echo ""
    echo "${INSTALL_DIR} is not in your PATH."
    echo "Add it by running one of the following (depending on your shell):"
    echo ""
    echo "  # bash"
    echo "  echo 'export PATH=\"${INSTALL_DIR}:\$PATH\"' >> ~/.bashrc && source ~/.bashrc"
    echo ""
    echo "  # zsh"
    echo "  echo 'export PATH=\"${INSTALL_DIR}:\$PATH\"' >> ~/.zshrc && source ~/.zshrc"
    echo ""
    echo "  # fish"
    echo "  fish_add_path ${INSTALL_DIR}"
    echo ""
    ;;
esac
