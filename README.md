# Job Search Copilot

[![CI](https://github.com/Ibrobar/job-search-copilot/actions/workflows/ci.yml/badge.svg)](https://github.com/Ibrobar/job-search-copilot/actions/workflows/ci.yml)

Paste a job description and get a fit score, your skill gaps, and a tailored one-page resume. **Every line of the
resume cites a real fact from your profile**, and a CI eval gate fails the build if the model invents experience.
Applications are tracked in a built-in CRM.

> Status: early development. A live link, architecture diagram, and eval results will be added as v1 ships.

## Stack
Next.js 16 + TypeScript, Azure Container Apps, Azure OpenAI (gpt-5-mini, text-embedding-3-small),
Azure Database for PostgreSQL + pgvector, Blob Storage, Key Vault with managed identity, Application Insights,
Bicep + azd, and GitHub Actions (OIDC). See [docs/adr](docs/adr).

## Run locally
```bash
pnpm install
cp .env.example .env
pnpm db:up        # Postgres + pgvector in Docker
pnpm dev          # http://localhost:3000
```

## Tests
```bash
pnpm lint && pnpm typecheck && pnpm test   # unit (Vitest)
pnpm e2e                                    # end-to-end (Playwright)
pnpm evals                                  # LLM quality gate (golden dataset + thresholds)
```

## Layout
```
apps/web        Next.js app (UI + API route handlers)
packages/core   schemas, truthfulness guard, scoring, LLM client interface
evals           golden dataset, runner, thresholds
infra           Bicep (azd)
docs/adr        architecture decision records
```
