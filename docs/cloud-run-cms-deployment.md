# Deploy CMS to Cloud Run

The CMS image must receive runtime configuration from Cloud Run. Do not copy
`apps/cms/.env` into the image or commit it to the repository.

This follows Google Cloud docs (Sept 2026):

- `run/docs/configuring/services/environment-variables` — plain vars via
  Console **Variables & Secrets > Add Variable**, or
  `gcloud run services update SERVICE --update-env-vars KEY=VALUE` (preferred:
  non-destructive; `--set-env-vars` **deletes** vars you omit), or
  `--env-vars-file`, or service YAML `env: [{name, value}]`. Limits: max 1000
  vars, 32 KiB each. Never set `PORT` (Cloud Run injects it) or
  `GOOGLE_APPLICATION_CREDENTIALS`. Keys cannot be empty, contain `=`, or use
  the `X_GOOGLE_` prefix. Values with commas need a custom delimiter
  (`--set-env-vars "^@^KEY1=a,b@KEY2=c"`). Every change creates a new revision.
  Dockerfile `ENV` only sets defaults; service-level vars win at runtime.
- `run/docs/configuring/services/secrets` — sensitive values (DB URIs, API
  keys, tokens) go in Secret Manager and are referenced as env vars
  (`--update-secrets ENV=SECRET:VERSION`, Console **Reference a secret**, YAML
  `valueFrom.secretKeyRef: {name, key}`). They resolve at instance startup; if
  retrieval fails the instance does not start. Pin a version number for
  reproducible prod, or use `latest` for simplicity. The runtime service
  account needs `roles/secretmanager.secretAccessor` on each secret or
  deployment fails the startup check.
- `run/docs/configuring/services/build-environment-variables` —
  `--set-build-env-vars` is for **buildpacks**, not Dockerfile builds.
  Dockerfile `docker build` does **not** see service env vars. For Dockerfile
  builds needing real secrets, use a `cloudbuild.yaml` with `availableSecrets`
  + `docker build --build-arg`. Next.js additionally inlines `NEXT_PUBLIC_*`
  at **build** time, so changing a `NEXT_PUBLIC_*` runtime var alone does not
  update the browser bundle — you must rebuild.

## Recommended: one-command sync from apps/cms/.env

`apps/cms/.env` holds 51 keys (Sept 2026 inventory). 17 are secrets, 34 are
plain config (see `cloudrun-service.yaml.example` for the full classified
list). `NODE_ENV` is forced to `production` on upload.

In Cloud Shell (repo root), or Windows PowerShell locally with `gcloud` auth:

```bash
bash scripts/cloud-run-sync-env.sh
# or: powershell -ExecutionPolicy Bypass -File scripts\cloud-run-sync-env.ps1
```

What it does (without ever printing values):

1. Parses `apps/cms/.env` (ignores comments/blanks, splits on first `=`,
   strips matching quotes, skips `PORT`, `GOOGLE_APPLICATION_CREDENTIALS`,
   `X_GOOGLE_*`).
2. For each of the 17 secrets (`DATABASE_URI`, `PAYLOAD_SECRET`,
   `PAYLOAD_API_KEY`, `UPSTASH_REDIS_REST_TOKEN`,
   `SUPABASE_SERVICE_ROLE_KEY`, `CLOUDINARY_API_KEY/SECRET`,
   `GOOGLE_MAPS_API_KEY`, `RESEND_API_KEY`, `PAYMONGO_*_LIVE/SANDBOX*`,
   `LALAMOVE_*`), creates the `tap2go-*` Secret Manager secret if missing, or
   adds a new version only when the value changed.
3. Grants the runtime SA (`PROJECT_NUMBER-compute@developer.gserviceaccount.com`
   for project `grandline-508001`) `roles/secretmanager.secretAccessor`.
4. Calls `gcloud run services update tap2go-git --region=asia-southeast1`
   with `--update-env-vars` (34 plain) + `--update-secrets` (17 refs, `:latest`).
   Non-destructive: existing vars not in `.env` are kept.

After it prints `Done`, server-only vars are live immediately. If you changed
any `NEXT_PUBLIC_*` (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`), trigger
a rebuild (`git push` / Console redeploy) so the client bundle picks them up.

## Manual alternative (Console / gcloud / YAML)

One-time APIs:

```bash
gcloud config set project grandline-508001
gcloud services enable run.googleapis.com secretmanager.googleapis.com
```

Secrets (example; repeat per key, values from your local `apps/cms/.env`):

```bash
printf '%s' "$DATABASE_URI" | gcloud secrets create tap2go-database-uri --data-file=-
printf '%s' "$PAYLOAD_SECRET" | gcloud secrets create tap2go-payload-secret --data-file=-
# later rotations (no overwrite of history):
printf '%s' "$DATABASE_URI" | gcloud secrets versions add tap2go-database-uri --data-file=-
```

IAM (once per secret; get `PROJECT_NUMBER` via
`gcloud projects describe grandline-508001 --format='value(projectNumber)'`):

```bash
gcloud secrets add-iam-policy-binding tap2go-database-uri \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

Service update (non-destructive; repeat `--update-env-vars` /
`--update-secrets` as needed — do NOT use `--set-env-vars` unless you list
every var):

```bash
gcloud run services update tap2go-git --region=asia-southeast1 \
  --update-env-vars "NODE_ENV=production,ADMIN_PROD_URL=https://admin.tap2goph.com,WEB_PROD_URL=https://app.tap2goph.com,CMS_PROD_URL=https://cms.tap2goph.com,COOKIE_DOMAIN=.tap2goph.com" \
  --update-secrets "DATABASE_URI=tap2go-database-uri:latest,PAYLOAD_SECRET=tap2go-payload-secret:latest"
```

Declarative alternative: fill the `REPLACE_WITH_*` placeholders in
`cloudrun-service.yaml.example` (never commit real values) and
`gcloud run services replace cloudrun-service.yaml --region=asia-southeast1`.

Console path: Cloud Run > `tap2go-git` > **Edit and deploy new revision** >
**Container(s) > Variables & Secrets** > **Add Variable** (plain) or
**Reference a secret** (secret, pick version). Pasting a whole `.env` into the
**Name** field auto-splits it into rows.

## Verify and deploy

After the revision is deployed, verify the health endpoint:

```bash
gcloud run services describe tap2go-git \
  --region=asia-southeast1 \
  --format='value(status.url)'

curl "SERVICE_URL/api/health"
```

The response must be HTTP 200 and contain `"status":"ok"`. Also open
`SERVICE_URL/admin` (redirects from `/`) and confirm Supabase/Cloudinary-backed
pages load — that proves the rebuilt `NEXT_PUBLIC_*` bundle matches runtime.

If deployment still fails, inspect the exact revision error:

```bash
gcloud run services describe tap2go-git \
  --region=asia-southeast1 \
  --format='yaml(status.conditions,status.latestCreatedRevisionName,status.latestReadyRevisionName)'

gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="tap2go-git"' \
  --project=grandline-508001 \
  --limit=100 \
  --format='value(timestamp,severity,textPayload,jsonPayload.message)'
```

Common causes per the docs: runtime SA missing `secretAccessor` ("Permission
denied" naming the SA + secret), a secret version deleted, a var over 32 KiB,
or `NEXT_PUBLIC_*` changed without a rebuild (client still shows old endpoint).
