#!/usr/bin/env bash
# Install a local macOS build of the Orca fork over /Applications/Orca.app.
#
# Usage:
#   bash config/scripts/fork-install-mac.sh [--dry-run] [--no-launch] [--app PATH]
#
# Runs detached in its own session (python3 os.setsid), because quitting Orca
# would otherwise kill the Orca terminal that started it. Follow the log for progress.
set -euo pipefail

SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
REPO_ROOT="$(cd "$(dirname "$SCRIPT_PATH")/../.." && pwd)"
APP="${ORCA_FORK_INSTALL_APP:-$REPO_ROOT/dist/mac-arm64/Orca.app}"
DEST="${ORCA_FORK_INSTALL_DEST:-/Applications/Orca.app}"
BACKUP_DIR="${ORCA_FORK_INSTALL_BACKUP_DIR:-$HOME/Library/Application Support/orca-fork-backups}"
LOG="${ORCA_FORK_INSTALL_LOG:-$HOME/Library/Logs/orca-fork-install.log}"
CLI_LINK="${ORCA_FORK_INSTALL_CLI_LINK:-/usr/local/bin/orca}"
QUIT_TIMEOUT_SECONDS="${ORCA_FORK_INSTALL_QUIT_TIMEOUT:-120}"
KEEP_BACKUPS=2
DRY_RUN=0
LAUNCH=1
DETACHED=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --no-launch) LAUNCH=0; shift ;;
    --app) APP="${2:?--app needs a path}"; shift 2 ;;
    --detached) DETACHED=1; shift ;;
    -h|--help)
      sed -n '2,8p' "$SCRIPT_PATH" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

log() { printf '%s %s\n' "$(date '+%Y-%m-%dT%H:%M:%S')" "$*"; }

plist_value() {
  /usr/libexec/PlistBuddy -c "Print :$2" "$1/Contents/Info.plist" 2>/dev/null || echo unknown
}

app_version() {
  echo "$(plist_value "$1" CFBundleShortVersionString) ($(plist_value "$1" CFBundleVersion))"
}

# Prints the command in a dry run, runs it otherwise.
act() {
  if [[ "$DRY_RUN" == 1 ]]; then
    log "dry run: would run: $*"
  else
    log "run: $*"
    "$@"
  fi
}

orca_running() {
  [[ "$(osascript -e "application id \"$1\" is running" 2>/dev/null)" == "true" ]]
}

if [[ "$DETACHED" == 0 ]]; then
  if [[ ! -f "$APP/Contents/Info.plist" ]]; then
    echo "No build at $APP. Run pnpm build:mac first." >&2
    exit 1
  fi
  echo "Build: $APP"
  echo "Version: $(app_version "$APP")"
  mkdir -p "$(dirname "$LOG")"
  args=(--app "$APP")
  [[ "$DRY_RUN" == 1 ]] && args+=(--dry-run)
  [[ "$LAUNCH" == 0 ]] && args+=(--no-launch)
  # Why fork before setsid: a process-group leader cannot start a new session.
  python3 -c '
import os, sys
if os.fork():
    sys.exit(0)
os.setsid()
log = os.open(sys.argv[1], os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o644)
null = os.open(os.devnull, os.O_RDONLY)
os.dup2(null, 0)
os.dup2(log, 1)
os.dup2(log, 2)
os.execv("/bin/bash", ["/bin/bash"] + sys.argv[2:])
' "$LOG" "$SCRIPT_PATH" --detached "${args[@]}"
  echo "Installing in the background. Log: $LOG"
  exit 0
fi

log "install started (pid $$, session $(python3 -c 'import os; print(os.getsid(0))'))"
[[ "$DRY_RUN" == 1 ]] && log "dry run: nothing is quit, moved, copied or launched"
log "build: $APP, version $(app_version "$APP")"

if [[ -d "$DEST" ]]; then
  bundle_id="$(plist_value "$DEST" CFBundleIdentifier)"
  old_version="$(plist_value "$DEST" CFBundleShortVersionString)"
  log "installed: $DEST, version $(app_version "$DEST")"
  if orca_running "$bundle_id"; then
    act osascript -e "tell application id \"$bundle_id\" to quit"
    if [[ "$DRY_RUN" == 0 ]]; then
      waited=0
      while orca_running "$bundle_id"; do
        if (( waited >= QUIT_TIMEOUT_SECONDS )); then
          log "Orca is still running after ${QUIT_TIMEOUT_SECONDS}s; nothing was replaced"
          exit 1
        fi
        sleep 1
        waited=$((waited + 1))
      done
      log "Orca quit after ${waited}s"
    fi
  else
    log "Orca is not running"
  fi
  # Why the timestamp leads: mv keeps the old app's mtime, so backups are ordered by name.
  backup="$BACKUP_DIR/Orca-$(date '+%Y%m%d-%H%M%S')-${old_version}.app"
  act mkdir -p "$BACKUP_DIR"
  act mv "$DEST" "$backup"
  # A dry run made no new backup, so it keeps one fewer of the existing ones.
  keep=$((KEEP_BACKUPS - DRY_RUN))
  if [[ -d "$BACKUP_DIR" ]]; then
    while IFS= read -r stale; do
      act rm -rf "$stale"
    done < <(find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -name 'Orca-*.app' | sort -r | tail -n "+$((keep + 1))")
  fi
else
  log "nothing installed at $DEST"
fi

act ditto "$APP" "$DEST"
if [[ "$LAUNCH" == 1 ]]; then
  act open "$DEST"
fi
if [[ "$DRY_RUN" == 0 ]]; then
  log "installed version: $(app_version "$DEST")"
fi
log "orca CLI: $CLI_LINK -> $(readlink "$CLI_LINK" 2>/dev/null || echo 'not a symlink')"
log "install finished"
