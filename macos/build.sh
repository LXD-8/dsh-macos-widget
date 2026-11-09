#!/usr/bin/env bash
# Build the WidgetKit companion and install it next to the user's apps.
# Requires Xcode and xcodegen. The extension reads the plugin bridge on
# 127.0.0.1:47823 (see Shared/QuotaLoader.swift).
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v xcodegen >/dev/null 2>&1; then
  echo "xcodegen is required: brew install xcodegen" >&2
  exit 1
fi

xcodegen generate
xcodebuild \
  -project DSHWidgets.xcodeproj \
  -scheme DSHWidgets \
  -configuration Release \
  -derivedDataPath build \
  CODE_SIGN_IDENTITY=- \
  CODE_SIGN_STYLE=Manual \
  DEVELOPMENT_TEAM= \
  build

APP="$HOME/Applications/DSHWidgets.app"
rm -rf "$APP"
mkdir -p "$HOME/Applications"
cp -R build/Build/Products/Release/DSHWidgets.app "$APP"
/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister -f -R "$APP"
echo "Installed $APP"
echo "Add it from: desktop right-click → Edit Widgets → 额度窗口"
