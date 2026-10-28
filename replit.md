# Jharkhand Enterprises Dashboard

A sales, purchasing, and analytics workspace for wholesale power-tools stores.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/jharkhand-tools-dashboard run dev` — run the dashboard
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required environment: `DATABASE_URL` — PostgreSQL connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React, Vite, Wouter, TanStack Query, Recharts
- API: Express 5 with OpenAPI-generated Zod validation and client hooks
- DB: PostgreSQL + Drizzle ORM
- Exports: XLSX workbooks, chart CSV, browser print/PDF
- Validation and API codegen: Zod, Drizzle, Orval
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/jharkhand-tools-dashboard/` — dashboard routes, UI, and theme
- `artifacts/api-server/src/routes/business.ts` — analytics, transactions, and master-data API
- `lib/api-spec/openapi.yaml` — source of truth for API contracts
- `lib/db/src/schema/power-tools.ts` — source of truth for persistent business data

## Architecture decisions

- Store records and transactions persist in PostgreSQL; charts are derived from saved transactions.
- The API calculates sale totals and profit from quantities and unit rates.
- The app seeds a small preview dataset only when the company catalog is empty.
- Reports download as `.xlsx`; chart data can be exported as CSV, and pages can be printed to PDF.

## Product

The app manages sales, purchases, companies/brands, products, customers/dealers, and suppliers. It includes transaction analytics, date-range reporting, payment status, recent activity, and editable master data.

## User preferences

Keep the dashboard bright and readable, with energetic charts and strong black-and-gold branding.

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
