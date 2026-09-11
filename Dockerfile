FROM node:22.12.0-alpine AS dependencies

RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY . .
RUN npm install --global pnpm@9.12.3 && pnpm install --frozen-lockfile

FROM dependencies AS builder

# Dummy build-time env so `next build` succeeds in Cloud Build without real
# secrets (.env is excluded from the build context via .dockerignore).
# Real values are injected at runtime via Cloud Run Variables & Secrets.
# Per Google docs (run/docs/configuring/services/environment-variables):
# - Dockerfile ENV sets defaults; service-level vars override them at runtime.
# - Service env vars are NOT visible during `docker build`.
# - Next.js inlines NEXT_PUBLIC_* at build time, so a change to any
#   NEXT_PUBLIC_* value requires a rebuild to reach the browser bundle.
#   Keep dummy defaults here; pass real public values via --build-arg in a
#   Cloud Build trigger (see docs/cloud-run-cms-deployment.md) or update the
#   defaults when rotating public endpoints. Never bake real secrets here.
ARG DATABASE_URI=postgresql://build:build@localhost:5432/build
ARG PAYLOAD_SECRET=build-placeholder-secret-min-32-chars-long-0000
ARG NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=build-placeholder
ARG NEXT_PUBLIC_SUPABASE_URL=https://build-placeholder.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=build-placeholder-anon-key
ARG CLOUDINARY_API_KEY=build-placeholder
ARG CLOUDINARY_API_SECRET=build-placeholder
ARG ADMIN_PROD_URL=https://admin.tap2goph.com
ARG WEB_PROD_URL=https://app.tap2goph.com
ARG CMS_PROD_URL=https://cms.tap2goph.com
ARG COOKIE_DOMAIN=.tap2goph.com
ENV DATABASE_URI=$DATABASE_URI \
  PAYLOAD_SECRET=$PAYLOAD_SECRET \
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=$NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME \
  NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
  NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
  CLOUDINARY_API_KEY=$CLOUDINARY_API_KEY \
  CLOUDINARY_API_SECRET=$CLOUDINARY_API_SECRET \
  ADMIN_PROD_URL=$ADMIN_PROD_URL \
  WEB_PROD_URL=$WEB_PROD_URL \
  CMS_PROD_URL=$CMS_PROD_URL \
  COOKIE_DOMAIN=$COOKIE_DOMAIN \
  NEXT_TELEMETRY_DISABLED=1 \
  NODE_ENV=production

RUN pnpm --filter @encreasl/cms build

FROM node:22.12.0-alpine AS runner

RUN apk add --no-cache libc6-compat libgcc libstdc++ vips-dev
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=8080
ENV NEXT_TELEMETRY_DISABLED=1
# Keep the V8 heap inside the Cloud Run memory limit (see
# cloudrun-service.yaml.example: 2Gi). Without this Node sizes the heap from
# the build/host machine and gets OOM-killed during Payload cold start,
# which Cloud Run reports as "failed to listen on PORT=8080".
ENV NODE_OPTIONS=--no-deprecation --max-old-space-size=1536

RUN addgroup --system --gid 1001 nodejs \
	&& adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/cms/.next/standalone ./

USER nextjs

EXPOSE 8080

CMD ["sh", "-c", "HOSTNAME=0.0.0.0 PORT=${PORT:-8080} exec node apps/cms/server.js"]
