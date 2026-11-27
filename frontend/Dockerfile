FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY sdk/package.json sdk/
COPY relayer/package.json relayer/
COPY circuits/package.json circuits/
# Workspace packages can nest unhoisted modules (e.g. frontend/@types/node@22
# vs a hoisted @types/node@12). Keep those dirs even if a given ci is fully hoisted.
RUN npm ci \
  && mkdir -p frontend/node_modules sdk/node_modules

FROM deps AS builder
WORKDIR /app
COPY sdk ./sdk
COPY frontend ./frontend
# Build context omits **/node_modules (.dockerignore). Overlaying `frontend/`
# (and `sdk/`) drops the workspace node_modules npm ci just created. Next then
# loads next.config.ts against the hoisted @types/node@12 and fails with
# Cannot find module 'node:path'. Restore the workspace installs after source.
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules
COPY --from=deps /app/sdk/node_modules ./sdk/node_modules

# PUBLIC BUILD-TIME - must be present at `next build`
ARG NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
ARG NEXT_PUBLIC_CLUSTER=devnet
ARG NEXT_PUBLIC_RELAYER_URL=https://ghost-api.arnabbhowmik.in
ARG NEXT_PUBLIC_PROGRAM_ID=69gepJRrDXGgaKExaUHWmDjtLe4LHxTrNiGVzBGoTczR
ARG NEXT_PUBLIC_USDC_MINT=
ARG NEXT_PUBLIC_ENABLE_DEV_WALLET=false
ARG NEXT_PUBLIC_SHIELD_ENABLED=
ARG NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
ARG NEXT_PUBLIC_SITE_URL=https://ghost.arnabbhowmik.in

ENV NEXT_PUBLIC_RPC_URL=$NEXT_PUBLIC_RPC_URL
ENV NEXT_PUBLIC_CLUSTER=$NEXT_PUBLIC_CLUSTER
ENV NEXT_PUBLIC_RELAYER_URL=$NEXT_PUBLIC_RELAYER_URL
ENV NEXT_PUBLIC_PROGRAM_ID=$NEXT_PUBLIC_PROGRAM_ID
ENV NEXT_PUBLIC_USDC_MINT=$NEXT_PUBLIC_USDC_MINT
ENV NEXT_PUBLIC_ENABLE_DEV_WALLET=$NEXT_PUBLIC_ENABLE_DEV_WALLET
ENV NEXT_PUBLIC_SHIELD_ENABLED=$NEXT_PUBLIC_SHIELD_ENABLED
ENV NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=$NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build --workspace @ghost/frontend

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/frontend/.next/standalone ./
COPY --from=builder /app/frontend/.next/static ./frontend/.next/static
COPY --from=builder /app/frontend/public ./frontend/public

EXPOSE 3000
CMD ["node", "frontend/server.js"]
