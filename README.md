# WoW Token Price

A single-page Persian Nuxt application showing live EU and US World of Warcraft Token prices with a seven-day history.

## Requirements

- Node.js with npm
- A Battle.net application Client ID and Client Secret
- A PostgreSQL database

The in-process collector and SSE fan-out require a long-running Node server.

## Setup

Install dependencies, copy the environment template, and configure both Battle.net credentials:

```bash
npm install
cp .env.example .env
```

```dotenv
NUXT_BATTLENET_CLIENT_ID=your-client-id
NUXT_BATTLENET_CLIENT_SECRET=your-client-secret
DATABASE_URL=postgresql://wowz:password@localhost:5432/wowz
```

`DATABASE_URL` takes precedence. If it is empty, configure the connection with
`DATABASE_HOST`, `DATABASE_NAME`, `DATABASE_PASSWORD`, `DATABASE_PORT`, and
`DATABASE_USER` instead.

Start the application:

```bash
npm run dev
```

Database migrations run automatically when the server connects to PostgreSQL,
before the scheduler or API handlers can use it. Migration failures stop
startup instead of allowing the application to run against an outdated schema.
`npm run db:migrate` remains available for manual maintenance.

Both credentials are required. They remain in Nuxt's server-only runtime configuration and are never returned to the browser.

The server collects EU and US quotes at startup, once per minute, and whenever the dashboard endpoint is requested. Quotes are deduplicated by region and Blizzard update timestamp and retained indefinitely; the UI displays the latest seven days.

The initial dashboard is server-rendered from `GET /api/wow-token`. After hydration, the browser connects to `GET /api/wow-token/stream` using Server-Sent Events. The stream immediately sends the current dashboard snapshot and pushes a new full snapshot whenever either regional price changes. This in-memory stream fan-out shares the same single-process deployment constraint as the collector.

## Validation

```bash
npm test -- --run
npm run typecheck
npx eslint .
npm run build
```

## Docker

Build and run the production image with access to PostgreSQL:

```bash
docker build -t wowz .
docker run --detach \
  --name wowz \
  --publish 3000:3000 \
  --env-file .env \
  --restart unless-stopped \
  wowz
```

The image runs the self-contained Nitro output as an unprivileged user and
includes a TCP health check. Keep the deployment to one replica unless the
scheduler and SSE fan-out are redesigned for multi-instance coordination.
