#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${SOURCE_ROOT:?}" "${RESULT_DIR:?}" "${RUNNER_TEMP:?}"
mkdir -p "$RESULT_DIR/logs" "$RESULT_DIR/package"
resource_check() {
  python3 - <<'PY'
import re, subprocess, shutil
total = int(subprocess.check_output(['sysctl', '-n', 'hw.memsize'], text=True))
pressure = subprocess.check_output(['memory_pressure', '-Q'], text=True)
match = re.search(r'System-wide memory free percentage:\s*(\d+)%', pressure)
if not match: raise SystemExit('Memory availability could not be determined')
available = total * int(match.group(1)) / 100
if available < max(3 * 1024**3, total * .2): raise SystemExit('Insufficient memory for the next build phase')
if shutil.disk_usage('.').free < 8 * 1024**3: raise SystemExit('Insufficient disk space for the next build phase')
PY
}
run_phase() {
  local phase="$1"
  shift
  printf 'Starting %s\n' "$phase"
  resource_check
  if "$@" > "$RESULT_DIR/logs/$phase.log" 2>&1; then
    printf 'Passed %s\n' "$phase"
  else
    printf 'Failed %s; details are in the encrypted result bundle.\n' "$phase"
    return 1
  fi
}
cd "$SOURCE_ROOT"
test -f mobile/app.json
run_phase dependencies pnpm --dir mobile install --frozen-lockfile
run_phase tests pnpm --dir mobile test
run_phase types pnpm --dir mobile typecheck
run_phase prebuild pnpm --dir mobile exec expo prebuild --clean --platform ios --no-install
run_phase pods bash -c 'cd mobile/ios && pod install'
export NODE_BINARY
NODE_BINARY="$(command -v node)"
run_phase archive xcodebuild -workspace mobile/ios/OpsPanel.xcworkspace -scheme OpsPanel -configuration Release -sdk iphoneos -destination 'generic/platform=iOS' -archivePath "$RUNNER_TEMP/OpsPanel.xcarchive" -derivedDataPath "$RUNNER_TEMP/opspanel-derived" -jobs 2 CODE_SIGNING_ALLOWED=NO archive
run_phase package node mobile/scripts/ios-release.cjs "$RUNNER_TEMP/OpsPanel.xcarchive" "$RESULT_DIR/package"
printf 'Device archive and lab package completed.\n'
