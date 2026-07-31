# WoW Token Price

A single-page Persian Nuxt application showing the EU World of Warcraft Token price and a clearly labeled seven-day demo trend.

## Setup

```bash
npm install
npm run dev
```

Without Battle.net credentials, the server returns deterministic demo data. To enable the live headline quote, copy `.env.example` to `.env` and set both server-only values:

```dotenv
NUXT_BATTLENET_CLIENT_ID=your-client-id
NUXT_BATTLENET_CLIENT_SECRET=your-client-secret
```

Battle.net exposes the latest token quote but not historical prices, so the chart remains explicitly marked as demo data in both modes.

## Validation

```bash
npm test -- --run
npm run typecheck
npx eslint .
npm run build
```
