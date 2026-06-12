# Structure, Build, and Backend Hardening Design

## Scope

This change splits Amail's public documentation out of the root README into a VitePress-powered project site, replaces fragile server asset copy commands with a reusable build asset pipeline, and hardens backend behavior around SMTP pooling, database initialization, API error handling, and SDK/server provider compatibility.

## Documentation

The repository root README becomes a concise project entry point. The VitePress site under `docs/` becomes the long-form home and documentation surface with sections for getting started, API usage, SDK usage, deployment, configuration, and architecture. The site should be buildable with `npm run docs:build`.

## Build Pipeline

The server package keeps TypeScript compilation separate from non-TypeScript asset staging. A dedicated `scripts/copy-server-assets.js` script copies declared asset directories into `packages/server/dist` after compilation. This centralizes build assets in one manifest so adding view templates, migrations, or future static files does not require changing shell-specific `cp -r` command chains.

## Backend

The server gains a small error boundary:

- `AppError` carries HTTP status, public error code, and public message.
- A Fastify global error handler serializes known errors consistently and hides unknown internal details.
- Zod validation errors become `validation_error` responses.
- Auth and route code can return or throw the same public error shape.

SMTP transport management keeps the existing per-provider cache but creates real pooled Nodemailer transports with configurable pool limits and timeouts. Cache invalidation still closes transports after provider changes.

SQLite remains the deployment database. Initialization stays singleton-based, but is wrapped in a clearer lifecycle module with WAL, foreign keys, busy timeout, and synchronous pragmas. Hot email send writes are grouped through transactions where practical to reduce partial state and repeated write overhead.

## Compatibility

Server send schemas accept both `provider_id` and the existing internal `provider` alias, normalizing to one `provider` field. This matches the SDK and README examples while preserving backward compatibility.

## Verification

Verification requires:

- Server unit tests for provider normalization, error serialization, and SMTP option pooling.
- `npm run build`.
- `npm run docs:build`.
- `npm --workspace=@amail/server run test`.
