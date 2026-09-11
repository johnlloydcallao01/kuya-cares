#!/bin/bash
# =============================================================================
# Sync apps/cms/.env -> Cloud Run (tap2go-git) + Secret Manager
# Run in Google Cloud Shell (or any machine with gcloud auth):
#   bash scripts/cloud-run-sync-env.sh
#
# Google docs followed:
# - run/docs/configuring/services/environment-variables
#   (--update-env-vars is non-destructive; --set-env-vars would WIPE vars not
#   listed. Max 1000 vars / 32 KiB each. Never set PORT or
#   GOOGLE_APPLICATION_CREDENTIALS. Any change creates a new revision.)
# - run/docs/configuring/services/secrets
#   (sensitive values via Secret Manager referenced as env vars with
#   --update-secrets ENV=SECRET:VERSION; runtime SA needs
#   roles/secretmanager.secretAccessor or instances fail to start.)
# - run/docs/configuring/services/build-environment-variables
#   (Dockerfile builds do NOT see service env vars; NEXT_PUBLIC_* are inlined
#   by Next.js at build time, so changing them requires a rebuild.)
#
# This script NEVER prints secret values. It reads apps/cms/.env locally and
# uploads via gcloud. .env stays uncommitted (see .gitignore / .dockerignore).
# =============================================================================
set -euo pipefail

SERVICE="tap2go-git"
REGION="asia-southeast1"
PROJECT="grandline-508001"
ENV_FILE="apps/cms/.env"

# ENV var -> Secret Manager secret name (sensitive per Google docs: credentials,
# API keys, tokens, DB URIs). Everything else in .env becomes a plain var.
# Existing names tap2go-database-uri / tap2go-payload-secret are kept stable.
declare -A SECRETS=(
  [DATABASE_URI]="tap2go-database-uri"
  [PAYLOAD_SECRET]="tap2go-payload-secret"
  [PAYLOAD_API_KEY]="tap2go-payload-api-key"
  [UPSTASH_REDIS_REST_TOKEN]="tap2go-upstash-redis-rest-token"
  [SUPABASE_SERVICE_ROLE_KEY]="tap2go-supabase-service-role-key"
  [CLOUDINARY_API_KEY]="tap2go-cloudinary-api-key"
  [CLOUDINARY_API_SECRET]="tap2go-cloudinary-api-secret"
  [GOOGLE_MAPS_API_KEY]="tap2go-google-maps-api-key"
  [RESEND_API_KEY]="tap2go-resend-api-key"
  [PAYMONGO_SECRET_KEY_LIVE]="tap2go-paymongo-secret-key-live"
  [PAYMONGO_SANDBOX_API_KEY]="tap2go-paymongo-sandbox-api-key"
  [PAYMONGO_WEBHOOK_SECRET]="tap2go-paymongo-webhook-secret"
  [PAYMONGO_SANDBOX_WEBHOOK_SECRET]="tap2go-paymongo-sandbox-webhook-secret"
  [LALAMOVE_API_KEY]="tap2go-lalamove-api-key"
  [LALAMOVE_API_SECRET]="tap2go-lalamove-api-secret"
  [LALAMOVE_SANDBOX_API_KEY]="tap2go-lalamove-sandbox-api-key"
  [LALAMOVE_SANDBOX_API_SECRET]="tap2go-lalamove-sandbox-api-secret"
)

# Keys that must never be uploaded (docs: reserved / injected).
SKIP_KEYS=("PORT" "GOOGLE_APPLICATION_CREDENTIALS")

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found. Run from repo root." >&2
  exit 1
fi

gcloud config set project "$PROJECT" >/dev/null
gcloud services enable run.googleapis.com secretmanager.googleapis.com >/dev/null

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
echo "Project: $PROJECT ($PROJECT_NUMBER)"
echo "Service: $SERVICE ($REGION), runtime SA: $RUNTIME_SA"

# --- Parse .env into associative array (split on FIRST '=', keep quotes raw) ---
declare -A ENV_VALUES=()
while IFS= read -r line || [[ -n "$line" ]]; do
  # trim leading/trailing whitespace
  trimmed="$(echo "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  [[ -z "$trimmed" || "$trimmed" == \#* ]] && continue
  [[ "$trimmed" != *"="* ]] && continue
  key="${trimmed%%=*}"
  val="${trimmed#*=}"
  key="$(echo "$key" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  # strip matching surrounding single/double quotes (dotenv convention)
  if [[ ${#val} -ge 2 ]]; then
    first="${val:0:1}"; last="${val: -1}"
    if [[ "$first" == '"' && "$last" == '"' ]] || [[ "$first" == "'" && "$last" == "'" ]]; then
      val="${val:1:-1}"
    fi
  fi
  [[ -z "$key" || "$key" == *"="* || "$key" == X_GOOGLE_* ]] && { echo "WARN: skipping invalid key '$key'"; continue; }
  skip=false; for s in "${SKIP_KEYS[@]}"; do [[ "$key" == "$s" ]] && skip=true; done
  [[ "$skip" == true ]] && { echo "WARN: skipping reserved key $key"; continue; }
  ENV_VALUES["$key"]="$val"
done < "$ENV_FILE"

# Force production runtime (local .env has NODE_ENV=development).
ENV_VALUES["NODE_ENV"]="production"

echo "Parsed ${#ENV_VALUES[@]} keys from $ENV_FILE (values never echoed)."

# --- Upsert secrets (create or add version only when changed) ---
for key in "${!SECRETS[@]}"; do
  secret="${SECRETS[$key]}"
  val="${ENV_VALUES[$key]:-}"
  if [[ -z "$val" ]]; then
    echo "SKIP secret $key: not present/empty in $ENV_FILE"
    continue
  fi
  if [[ ${#val} -gt 32768 ]]; then echo "ERROR: secret $key exceeds 32 KiB limit" >&2; exit 1; fi
  if ! gcloud secrets describe "$secret" --project="$PROJECT" >/dev/null 2>&1; then
    printf '%s' "$val" | gcloud secrets create "$secret" --project="$PROJECT" --data-file=-
    echo "Created secret $secret for $key"
  else
    current="$(gcloud secrets versions access latest --secret="$secret" --project="$PROJECT" 2>/dev/null || true)"
    if [[ "$current" == "$val" ]]; then
      echo "Secret $secret ($key) unchanged, skipping new version"
    else
      printf '%s' "$val" | gcloud secrets versions add "$secret" --project="$PROJECT" --data-file=-
      echo "Added new version to $secret ($key changed)"
    fi
  fi
  gcloud secrets add-iam-policy-binding "$secret" --project="$PROJECT" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor" >/dev/null
done

# --- Build --update-env-vars (plain) and --update-secrets (secret refs) ---
plain_pairs=()
secret_pairs=()
needs_rebuild=false
for key in "${!ENV_VALUES[@]}"; do
  if [[ -n "${SECRETS[$key]:-}" ]]; then
    secret_pairs+=("${key}=${SECRETS[$key]}:latest")
  else
    val="${ENV_VALUES[$key]}"
    if [[ ${#val} -gt 32768 ]]; then echo "ERROR: var $key exceeds 32 KiB" >&2; exit 1; fi
    plain_pairs+=("${key}=${val}")
  fi
  case "$key" in NEXT_PUBLIC_*) needs_rebuild=true ;; esac
done

# Comma in any value requires a custom delimiter (docs: --set-env-vars "^@^..").
delimiter=","
for p in "${plain_pairs[@]}"; do
  if [[ "$p" == *","* ]]; then delimiter="@"; break; fi
done

echo "Updating ${#plain_pairs[@]} plain vars + ${#secret_pairs[@]} secret refs (non-destructive)..."
if [[ "$delimiter" == "@" ]]; then
  joined_plain="$(printf '@%s' "${plain_pairs[@]}")"; joined_plain="^@^${joined_plain:1}"
else
  joined_plain="$(IFS=,; echo "${plain_pairs[*]}")"
fi
joined_secrets="$(IFS=,; echo "${secret_pairs[*]}")"

gcloud run services update "$SERVICE" --project="$PROJECT" --region="$REGION" \
  --update-env-vars "$joined_plain" \
  --update-secrets "$joined_secrets"

echo "Done. New revision created."
if [[ "$needs_rebuild" == true ]]; then
  echo "NOTE: NEXT_PUBLIC_* values were uploaded as runtime vars, but Next.js"
  echo "inlines them at BUILD time. Trigger a rebuild (git push / redeploy) for"
  echo "browser bundles to pick them up. Server-only vars are live now."
fi
echo "Verify: curl \"\$(gcloud run services describe $SERVICE --project=$PROJECT --region=$REGION --format='value(status.url)')/api/health\""
