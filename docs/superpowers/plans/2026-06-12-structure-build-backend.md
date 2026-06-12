# Structure Build Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split docs into a VitePress site, replace brittle server asset copy commands, and harden backend pooling and error handling.

**Architecture:** Keep the monorepo layout. Add focused server utility modules for errors and email request normalization, a build asset script at the root, and a VitePress site in `docs/`.

**Tech Stack:** Node.js, TypeScript, Fastify, Drizzle, better-sqlite3, Nodemailer, VitePress, Node test runner with `tsx`.

---

### Task 1: Backend behavior tests

**Files:**
- Create: `packages/server/src/api/email-schema.test.ts`
- Create: `packages/server/src/errors.test.ts`
- Create: `packages/server/src/smtp/manager.test.ts`
- Modify: `packages/server/package.json`

- [ ] Add tests proving `provider_id` normalizes to `provider`, AppError serializes safely, and SMTP options enable pooling.
- [ ] Run `npm --workspace=@amail/server run test` and confirm the tests fail before implementation.

### Task 2: Backend implementation

**Files:**
- Create: `packages/server/src/errors.ts`
- Create: `packages/server/src/api/email-schema.ts`
- Modify: `packages/server/src/api/emails.ts`
- Modify: `packages/server/src/index.ts`
- Modify: `packages/server/src/smtp/manager.ts`
- Modify: `packages/server/src/config.ts`
- Modify: `packages/server/src/db/index.ts`
- Modify: `packages/server/src/services/email-sender.ts`

- [ ] Implement shared errors and global Fastify error handling.
- [ ] Move email request schemas into a reusable normalizer accepting both `provider_id` and `provider`.
- [ ] Configure Nodemailer transports with pool options and timeouts.
- [ ] Harden SQLite pragmas and group email status/analytics writes in transactions.
- [ ] Run server tests until they pass.

### Task 3: Build pipeline

**Files:**
- Create: `scripts/copy-server-assets.js`
- Modify: `packages/server/package.json`
- Modify: `package.json`

- [ ] Replace shell-specific `cp -r` build step with `node ../../scripts/copy-server-assets.js`.
- [ ] Keep asset directories declared in one manifest.
- [ ] Run server build and verify `dist/web` and `dist/db/migrations` are present.

### Task 4: Documentation site

**Files:**
- Create: `docs/.vitepress/config.ts`
- Create: `docs/index.md`
- Create: `docs/guide/getting-started.md`
- Create: `docs/guide/configuration.md`
- Create: `docs/api/http.md`
- Create: `docs/sdk/node.md`
- Create: `docs/deploy/docker.md`
- Create: `docs/architecture.md`
- Modify: `README.md`
- Modify: `package.json`

- [ ] Add VitePress config, navigation, and sidebar.
- [ ] Move long README material into focused docs pages.
- [ ] Keep root README as a concise landing page.
- [ ] Run `npm run docs:build`.

### Task 5: Final verification

**Files:**
- Verify all changed files.

- [ ] Run `npm --workspace=@amail/server run test`.
- [ ] Run `npm run build`.
- [ ] Run `npm run docs:build`.
- [ ] Report exact verification results.
