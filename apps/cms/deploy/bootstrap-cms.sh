#!/bin/bash
set -euo pipefail

APP_DIR="/home/opc/tap2go"
ENV_FILE="/home/opc/original-cms.env"
REPO_URL="https://github.com/johnlloydcallao01/tap2go.git"
SERVICE_NAME="tap2go-cms"

log() { echo "[bootstrap-cms] $*"; }

if [ "$(id -u)" -eq 0 ]; then
  log "Run this as the 'opc' user, not root"
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  log "ERROR: $ENV_FILE not found."
  log "Upload your local env file first from Windows:"
  log "  scp -i <key> tap2go/apps/cms/.env opc@<new-ip>:/home/opc/original-cms.env"
  exit 1
fi

log "Installing system packages"
sudo apt-get update -y
sudo apt-get install -y nginx postgresql postgresql-contrib git curl ufw

log "Installing Node.js 22 LTS and pnpm"
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pnpm@9.12.3

log "Configuring firewall"
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

log "Creating Postgres role and database from DATABASE_URI"
DB_URI=$(grep -E '^DATABASE_URI=' "$ENV_FILE" | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'")
DB_USER=$(echo "$DB_URI" | sed -E 's#^[a-z]+://([^:]+):.*#\1#')
DB_PASS=$(echo "$DB_URI" | sed -E 's#^[a-z]+://[^:]+:([^@]+)@.*#\1#')
DB_NAME=$(echo "$DB_URI" | sed -E 's#.*/([^/?]+)(\?.*)?$#\1#')
log "Parsed DB_USER=$DB_USER DB_NAME=$DB_NAME (verify these are correct)"
sudo systemctl enable --now postgresql
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE ROLE \"$DB_USER\" LOGIN PASSWORD '$DB_PASS';"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \
  sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"

log "Cloning repository"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
fi

NEW_IP=$(curl -s http://169.254.169.254/opc/v2/vnics/ | grep -o '"publicIp": *"[^"]*"' | head -n1 | cut -d'"' -f4 || true)
log "Detected public IP: ${NEW_IP:-unknown}"

log "Installing nginx site"
sudo cp "$APP_DIR/apps/cms/deploy/tap2go-cms.nginx.http-only.conf" /etc/nginx/sites-available/tap2go-cms.conf
if [ -n "${NEW_IP:-}" ]; then
  sudo sed -i "s/140\.245\.35\.15/$NEW_IP/" /etc/nginx/sites-available/tap2go-cms.conf
fi
sudo ln -sf /etc/nginx/sites-available/tap2go-cms.conf /etc/nginx/sites-enabled/tap2go-cms.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo mkdir -p /var/www/acme
sudo nginx -t
sudo systemctl reload nginx

log "Installing systemd service"
sudo cp "$APP_DIR/apps/cms/deploy/tap2go-cms.service" /etc/systemd/system/$SERVICE_NAME.service
sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME

log "Running first deploy (git pull, pnpm install, build, start)"
"$APP_DIR/apps/cms/deploy/redeploy-cms.sh"

PUBLIC_IP=$(curl -s https://api.ipify.org || echo "<your-ip>")
log "Bootstrap complete. CMS should be live on port 80 at http://$PUBLIC_IP"
log "Next: point DNS cms.tap2goph.com -> $PUBLIC_IP, then run:"
log "  sudo apt-get install -y certbot python3-certbot-nginx"
log "  sudo certbot --nginx -d cms.tap2goph.com"
