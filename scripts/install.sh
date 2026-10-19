#!/bin/sh
# Git Light installer / updater for macOS.
#
# Downloads the latest release from GitHub, verifies it against CHECKSUMS.txt,
# and replaces /Applications/Git Light.app.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/ftuyama/git-light/main/scripts/install.sh | sh
#   sh install.sh [--uninstall] [--no-open] [--quiet]
#
# Why this works: curl (unlike browsers) does not attach the com.apple.quarantine
# flag, so macOS Gatekeeper never blocks the app, even though builds are
# ad-hoc signed.
set -eu

REPO="ftuyama/git-light"
APP_NAME="Git Light"
APP_PATH="/Applications/${APP_NAME}.app"
BASE="https://github.com/${REPO}"

QUIET=0
OPEN_APP=1
UNINSTALL=0
for arg in "$@"; do
  case "$arg" in
    --quiet) QUIET=1 ;;
    --no-open) OPEN_APP=0 ;;
    --uninstall) UNINSTALL=1 ;;
    -h|--help)
      echo "Usage: sh install.sh [--uninstall] [--no-open] [--quiet]"
      exit 0
      ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

say() { [ "$QUIET" -eq 1 ] || printf '%s\n' "$*"; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { say "Error: '$1' is required but not installed."; exit 1; }
}
require_cmd curl
require_cmd shasum
require_cmd tar

# --- macOS check -------------------------------------------------------------
if [ "$(uname -s)" != "Darwin" ]; then
  say "This script is for macOS. For Windows (.exe) or Linux (.AppImage/.deb), see:"
  say "  https://github.com/${REPO}/releases/latest"
  exit 1
fi

# --- Uninstall ---------------------------------------------------------------
if [ "$UNINSTALL" -eq 1 ]; then
  [ -d "$APP_PATH" ] || { say "${APP_NAME} is not installed in /Applications."; exit 0; }
  pgrep -f "${APP_NAME}" >/dev/null 2>&1 && {
    say "Quitting ${APP_NAME}..."
    osascript -e 'quit app "Git Light"' >/dev/null 2>&1 || true
    sleep 2
  }
  rm -rf "$APP_PATH"
  say "${APP_NAME} removed."
  exit 0
fi

# --- Architecture check ------------------------------------------------------
case "$(uname -m)" in
  arm64|aarch64) ARCH="aarch64" ;;
  x86_64) ARCH="x86_64";;
    *) say "Unsupported macOS architecture: $(uname -m)"; exit 1;;
esac
if [ "$ARCH" = "x86_64" ]; then
  say "Releases are currently built for Apple Silicon (aarch64) only."
  say "If you're on Intel, please open an issue at https://github.com/${REPO}/issues"
  exit 1
fi

# --- Resolve latest tag (no API/JSON parsing needed) --------------------------
say "Resolving latest release..."
LATEST_URL="$BASE/releases/latest"
TAG=$(curl -fsSL -o /dev/null -w '%{url_effective}' "$LATEST_URL" | sed -E 's|^.*/tag/||')
[ -n "$TAG" ] || { say "Error: could not resolve the latest release tag."; exit 1; }
say "Latest release: $TAG"

VERSION="${TAG#v}"
ASSET="Git.Light_${VERSION}_${ARCH}.app.tar.gz"
ASSET_URL="$BASE/releases/download/$TAG/$ASSET"

TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/git-light-install.XXXXXX")
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

# --- Download -----------------------------------------------------------------
say "Downloading $ASSET..."
curl -fsSL --retry 3 -o "$TMP_DIR/$ASSET" "$ASSET_URL" || {
  say "Error: download failed from $ASSET_URL"
  exit 1
}

# --- Verify checksum (if the release has CHECKSUMS.txt) ------------------------
if curl -fsSL -o "$TMP_DIR/CHECKSUMS.txt" "$BASE/releases/download/$TAG/CHECKSUMS.txt" 2>/dev/null; then
  say "Verifying checksum..."
  ( cd "$TMP_DIR" && shasum -a 256 -c CHECKSUMS.txt --status ) || {
    say "Error: checksum mismatch — the download may be corrupted. Aborting."
    exit 1
  }
  say "Checksum OK."
else
  say "Warning: no CHECKSUMS.txt in this release (released before checksum support)."
  say "Continuing without verification. Re-run after the next release to get verified installs."
fi

# --- Prepare target directory --------------------------------------------------
if [ -d "$APP_PATH" ]; then
  if [ ! -w "/Applications" ]; then
    say "Error: $APP_PATH already exists and /Applications is not writable."
    say "Re-run with: sudo sh install.sh"
    exit 1
  fi
fi

# --- Quit a running instance --------------------------------------------------
if pgrep -f "Git Light.app/Contents/MacOS" >/dev/null 2>&1; then
  say "Quitting running ${APP_NAME}..."
  osascript -e 'quit app "Git Light"' >/dev/null 2>&1 || true
  # Give the app a moment to exit; the app also self-exits when it drives an update.
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    pgrep -f "Git Light.app/Contents/MacOS" >/dev/null 2>&1 || break
    sleep 1
  done
fi

# --- Extract and swap ----------------------------------------------------------
say "Extracting..."
mkdir -p "$TMP_DIR/extract"
tar xzf "$TMP_DIR/$ASSET" -C "$TMP_DIR/extract"
NEW_APP=$(find "$TMP_DIR/extract" -maxdepth 1 -name "*.app" -mindepth 1 | head -n 1)
[ -d "$NEW_APP" ] || { say "Error: no .app found in the archive."; exit 1; }

say "Installing to $APP_PATH..."
if [ -d "$APP_PATH" ]; then
  rm -rf "$APP_PATH"
fi
cp -R "$NEW_APP" "$APP_PATH"

# Re-seal the bundle with a valid ad-hoc signature: release tarballs carry a
# linker-signed main binary whose bundle-level verification reports
# "code has no resources but signature indicates they must be present".
if command -v codesign >/dev/null 2>&1; then
  codesign --force --deep --sign - "$APP_PATH" >/dev/null 2>&1 || true
fi

# --- Launch ----------------------------------------------------------------------
if [ "$OPEN_APP" -eq 1 ]; then
  say "Launching ${APP_NAME}..."
  open "$APP_PATH"
fi

say "Done. ${APP_NAME} $TAG is installed."
