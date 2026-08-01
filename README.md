# WoW Token Price

A single-page Persian Nuxt application showing live EU and US World of Warcraft Token prices with a seven-day history.

## Requirements

- Node.js with npm
- A Battle.net application Client ID and Client Secret
- One long-running Node server with persistent storage for the SQLite file

The in-process hourly collector and local SQLite database are not suitable for serverless or multi-instance deployments.

## Setup

Install dependencies, copy the environment template, and configure both Battle.net credentials:

```bash
npm install
cp .env.example .env
```

```dotenv
NUXT_BATTLENET_CLIENT_ID=your-client-id
NUXT_BATTLENET_CLIENT_SECRET=your-client-secret
NUXT_SQLITE_PATH=.data/wow-token.sqlite
```

Start the application:

```bash
npm run dev
```

Database migrations run automatically and synchronously when the server opens
SQLite, before the scheduler or API handlers can use it. Migration failures stop
startup instead of allowing the application to run against an outdated schema.
`npm run db:migrate` remains available for manual maintenance.

Both credentials are required. They remain in Nuxt's server-only runtime configuration and are never returned to the browser.

The server collects EU and US quotes at startup, once per minute, and whenever the dashboard endpoint is requested. Quotes are deduplicated by region and Blizzard update timestamp and retained indefinitely; the UI displays the latest seven days.

The initial dashboard is server-rendered from `GET /api/wow-token`. After hydration, the browser connects to `GET /api/wow-token/stream` using Server-Sent Events. The stream immediately sends the current dashboard snapshot and pushes a new full snapshot whenever either regional price changes. This in-memory stream fan-out shares the same single-process deployment constraint as the collector and SQLite database.

## Validation

```bash
npm test -- --run
npm run typecheck
npx eslint .
npm run build
```

## Docker

Build the production image and run it with a persistent volume for SQLite:

```bash
docker build -t wowz .
docker run --detach \
  --name wowz \
  --publish 3000:3000 \
  --env-file .env \
  --volume wowz-data:/app/.data \
  --restart unless-stopped \
  wowz
```

The image runs the self-contained Nitro output as an unprivileged user and
includes a TCP health check. Keep the deployment to one replica because the
scheduler, SSE fan-out, and SQLite database are process-local.
