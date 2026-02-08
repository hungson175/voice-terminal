#!/bin/bash
# Voice Terminal — One-line installer for macOS
# Usage: curl -fsSL https://raw.githubusercontent.com/hungson175/voice-terminal/main/install.sh | bash

set -e

REPO="hungson175/voice-terminal"
APP_NAME="Voice Terminal"
INSTALL_DIR="/Applications"

echo "Installing $APP_NAME..."

# Detect architecture
ARCH=$(uname -m)
if [ "$ARCH" != "arm64" ] && [ "$ARCH" != "x86_64" ]; then
  echo "Error: Unsupported architecture: $ARCH"
  exit 1
fi

# Get latest release DMG URL
DMG_URL=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
  | grep "browser_download_url.*\.dmg" \
  | head -1 \
  | cut -d '"' -f 4)

if [ -z "$DMG_URL" ]; then
  echo "Error: No DMG found in latest release."
  echo "Visit https://github.com/$REPO/releases for manual download."
  exit 1
fi

TMPDIR=$(mktemp -d)
DMG_FILE="$TMPDIR/VoiceTerminal.dmg"

echo "Downloading from $DMG_URL..."
curl -fSL -o "$DMG_FILE" "$DMG_URL"

echo "Mounting DMG..."
MOUNT_POINT=$(hdiutil attach "$DMG_FILE" -nobrowse -quiet | tail -1 | awk '{print $NF}')

# Find the .app in the mounted volume
# hdiutil output format varies, find the mount point properly
VOLUME=$(hdiutil attach "$DMG_FILE" -nobrowse -quiet 2>/dev/null | grep "/Volumes/" | sed 's/.*\/Volumes/\/Volumes/')
if [ -z "$VOLUME" ]; then
  # Already mounted from above, find it
  VOLUME=$(ls -d /Volumes/Voice\ Terminal* 2>/dev/null | head -1)
fi

APP_PATH="$VOLUME/$APP_NAME.app"

if [ ! -d "$APP_PATH" ]; then
  echo "Error: Could not find $APP_NAME.app in DMG."
  hdiutil detach "$VOLUME" -quiet 2>/dev/null
  rm -rf "$TMPDIR"
  exit 1
fi

# Remove old version if exists
if [ -d "$INSTALL_DIR/$APP_NAME.app" ]; then
  echo "Removing old version..."
  rm -rf "$INSTALL_DIR/$APP_NAME.app"
fi

echo "Copying to $INSTALL_DIR..."
cp -R "$APP_PATH" "$INSTALL_DIR/"

echo "Cleaning up..."
hdiutil detach "$VOLUME" -quiet 2>/dev/null
rm -rf "$TMPDIR"

echo ""
echo "Installed! Launch '$APP_NAME' from Spotlight or $INSTALL_DIR."
echo ""
echo "Prerequisites:"
echo "  1. Get a Soniox API key at https://soniox.com"
echo "  2. Configure Kitty: add 'allow_remote_control yes' and"
echo "     'listen_on unix:/tmp/mykitty-{kitty_pid}' to ~/.config/kitty/kitty.conf"
