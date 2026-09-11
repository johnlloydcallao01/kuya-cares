#!/bin/bash
set -euo pipefail

APP_DIR="/home/opc/tap2go"
REPO_URL="https://github.com/johnlloydcallao01/tap2go.git"
BRANCH="main"
ENV_FILE="/home/opc/original-cms.env"
SYSTEMD_SERVICE="tap2go-cms"

log() {
  echo "[redeploy-cms] $*"
}

ensure_repo() {
  if [ -d "$APP_DIR/.git" ]; then
    git -C "$APP_DIR" remote set-url origin "$REPO_URL"
    return
  fi

  log "Bootstrapping git repository in $APP_DIR"
  git -C "$APP_DIR" init
  git -C "$APP_DIR" remote add origin "$REPO_URL"
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" branch -M "$BRANCH"
  git -C "$APP_DIR" reset "origin/$BRANCH"
}

restore_env() {
  if [ ! -f "$ENV_FILE" ]; then
    log "Missing env file: $ENV_FILE"
    exit 1
  fi

  cp "$ENV_FILE" "$APP_DIR/apps/cms/.env"
}

deploy() {
  log "Fetching latest code from GitHub"
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
  git -C "$APP_DIR" clean -fdx

  restore_env

  cd "$APP_DIR"
  log "Installing dependencies"
  pnpm install --frozen-lockfile

  log "Building apps/cms"
  pnpm --filter @encreasl/cms build

  log "Restarting $SYSTEMD_SERVICE"
  sudo systemctl restart "$SYSTEMD_SERVICE"
  sudo systemctl is-active "$SYSTEMD_SERVICE" >/dev/null
}

ensure_repo
deploy

log "Redeploy complete"
