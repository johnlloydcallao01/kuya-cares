#Requires -Version 5.1
<#
.SYNOPSIS
  Sync apps/cms/.env -> Cloud Run (tap2go-git) + Secret Manager (Windows).
  Run from repo root: powershell -ExecutionPolicy Bypass -File scripts\cloud-run-sync-env.ps1

  Google docs followed:
  - run/docs/configuring/services/environment-variables (--update-env-vars is
    non-destructive; never set PORT or GOOGLE_APPLICATION_CREDENTIALS;
    max 1000 vars / 32 KiB each; any change creates a new revision.)
  - run/docs/configuring/services/secrets (--update-secrets ENV=SECRET:VERSION;
    runtime SA needs roles/secretmanager.secretAccessor.)
  - run/docs/configuring/services/build-environment-variables (Dockerfile builds
    do NOT see service env vars; NEXT_PUBLIC_* are inlined at build time, so
    changing them requires a rebuild.)

  NEVER prints secret values. Reads apps/cms/.env locally and uploads via gcloud.
#>
$ErrorActionPreference = 'Stop'
$Service = 'tap2go-git'
$Region = 'asia-southeast1'
$Project = 'grandline-508001'
$EnvFile = 'apps/cms/.env'

$Secrets = [ordered]@{
  'DATABASE_URI' = 'tap2go-database-uri'
  'PAYLOAD_SECRET' = 'tap2go-payload-secret'
  'PAYLOAD_API_KEY' = 'tap2go-payload-api-key'
  'UPSTASH_REDIS_REST_TOKEN' = 'tap2go-upstash-redis-rest-token'
  'SUPABASE_SERVICE_ROLE_KEY' = 'tap2go-supabase-service-role-key'
  'CLOUDINARY_API_KEY' = 'tap2go-cloudinary-api-key'
  'CLOUDINARY_API_SECRET' = 'tap2go-cloudinary-api-secret'
  'GOOGLE_MAPS_API_KEY' = 'tap2go-google-maps-api-key'
  'RESEND_API_KEY' = 'tap2go-resend-api-key'
  'PAYMONGO_SECRET_KEY_LIVE' = 'tap2go-paymongo-secret-key-live'
  'PAYMONGO_SANDBOX_API_KEY' = 'tap2go-paymongo-sandbox-api-key'
  'PAYMONGO_WEBHOOK_SECRET' = 'tap2go-paymongo-webhook-secret'
  'PAYMONGO_SANDBOX_WEBHOOK_SECRET' = 'tap2go-paymongo-sandbox-webhook-secret'
  'LALAMOVE_API_KEY' = 'tap2go-lalamove-api-key'
  'LALAMOVE_API_SECRET' = 'tap2go-lalamove-api-secret'
  'LALAMOVE_SANDBOX_API_KEY' = 'tap2go-lalamove-sandbox-api-key'
  'LALAMOVE_SANDBOX_API_SECRET' = 'tap2go-lalamove-sandbox-api-secret'
}
$SkipKeys = @('PORT', 'GOOGLE_APPLICATION_CREDENTIALS')

if (-not (Test-Path -LiteralPath $EnvFile)) { throw "$EnvFile not found. Run from repo root." }

& gcloud config set project $Project | Out-Null
& gcloud services enable run.googleapis.com secretmanager.googleapis.com | Out-Null
$ProjectNumber = (& gcloud projects describe $Project --format='value(projectNumber)').Trim()
$RuntimeSa = "$ProjectNumber-compute@developer.gserviceaccount.com"
Write-Output "Project: $Project ($ProjectNumber)"
Write-Output "Service: $Service ($Region), runtime SA: $RuntimeSa"

$EnvValues = [ordered]@{}
Get-Content -LiteralPath $EnvFile | ForEach-Object {
  $line = $_.Trim()
  if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith('#')) { return }
  $idx = $line.IndexOf('=')
  if ($idx -lt 0) { return }
  $key = $line.Substring(0, $idx).Trim()
  $val = $line.Substring($idx + 1)
  if ($val.Length -ge 2) {
    $f = $val[0]; $l = $val[$val.Length - 1]
    if (($f -eq '"' -and $l -eq '"') -or ($f -eq "'" -and $l -eq "'")) { $val = $val.Substring(1, $val.Length - 2) }
  }
  if ([string]::IsNullOrEmpty($key) -or $key.Contains('=') -or $key.StartsWith('X_GOOGLE_')) { Write-Output "WARN: skipping invalid key '$key'"; return }
  if ($SkipKeys -contains $key) { Write-Output "WARN: skipping reserved key $key"; return }
  $EnvValues[$key] = $val
}
$EnvValues['NODE_ENV'] = 'production'
Write-Output "Parsed $($EnvValues.Count) keys from $EnvFile (values never echoed)."

foreach ($key in $Secrets.Keys) {
  $secret = $Secrets[$key]
  if (-not $EnvValues.Contains($key) -or [string]::IsNullOrEmpty($EnvValues[$key])) { Write-Output "SKIP secret ${key}: not present/empty"; continue }
  $val = $EnvValues[$key]
  if ($val.Length -gt 32768) { throw "Secret $key exceeds 32 KiB limit" }
  & gcloud secrets describe $secret --project=$Project 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    $val | & gcloud secrets create $secret --project=$Project --data-file=- | Out-Null
    Write-Output "Created secret $secret for $key"
  } else {
    $current = (& gcloud secrets versions access latest --secret=$secret --project=$Project 2>$null | Out-String)
    if ($null -ne $current) { $current = $current.TrimEnd("`r", "`n") }
    if ($current -ceq $val) { Write-Output "Secret $secret ($key) unchanged, skipping" }
    else { $val | & gcloud secrets versions add $secret --project=$Project --data-file=- | Out-Null; Write-Output "Added new version to $secret ($key changed)" }
  }
  & gcloud secrets add-iam-policy-binding $secret --project=$Project --member="serviceAccount:$RuntimeSa" --role='roles/secretmanager.secretAccessor' | Out-Null
}

$plainPairs = New-Object System.Collections.Generic.List[string]
$secretPairs = New-Object System.Collections.Generic.List[string]
$needsRebuild = $false
foreach ($key in $EnvValues.Keys) {
  if ($Secrets.Contains($key)) { $secretPairs.Add("$key=$($Secrets[$key]):latest") }
  else {
    if ($EnvValues[$key].Length -gt 32768) { throw "Var $key exceeds 32 KiB" }
    $plainPairs.Add("$key=$($EnvValues[$key])")
  }
  if ($key.StartsWith('NEXT_PUBLIC_')) { $needsRebuild = $true }
}
$joinedPlain = ($plainPairs -join ',')
if ($joinedPlain.Contains(',')) {
  # Values contain commas in this run? Our current .env has none, but per docs
  # use ^@^ delimiter when needed. Rebuild with @ delimiter if any VALUE has comma.
  $hasCommaValue = $false
  foreach ($p in $plainPairs) { $v = $p.Substring($p.IndexOf('=') + 1); if ($v.Contains(',')) { $hasCommaValue = $true; break } }
  if ($hasCommaValue) { $joinedPlain = '^@^' + ($plainPairs -join '@') }
}
$joinedSecrets = ($secretPairs -join ',')
Write-Output "Updating $($plainPairs.Count) plain vars + $($secretPairs.Count) secret refs (non-destructive)..."
& gcloud run services update $Service --project=$Project --region=$Region --update-env-vars $joinedPlain --update-secrets $joinedSecrets
if ($LASTEXITCODE -ne 0) { throw 'gcloud run services update failed' }
Write-Output 'Done. New revision created.'
if ($needsRebuild) {
  Write-Output 'NOTE: NEXT_PUBLIC_* uploaded as runtime vars, but Next.js inlines them at BUILD time.'
  Write-Output 'Trigger a rebuild (git push / redeploy) for browser bundles to pick them up.'
}
Write-Output 'Verify: $url = gcloud run services describe tap2go-git --project=grandline-508001 --region=asia-southeast1 --format=value(status.url); curl "$url/api/health"'
