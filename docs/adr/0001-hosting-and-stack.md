# 0001: Hosting and stack

- Status: Accepted
- Date: 2026-10-06

## Context
v1 needs a web UI, an API, sign-in, Postgres with pgvector, blob storage, and Azure OpenAI. Secrets must come from
managed identity or Key Vault, never from code. The target running cost is about $0/month apart from LLM tokens.

## Decision
- **One Next.js app (UI + route handlers) on Azure Container Apps**, consumption plan, scale to zero. The
  consumption free grant covers expected traffic.
- **Built-in Container Apps authentication** (GitHub and Microsoft providers) for multi-user sign-in.
- **A system-assigned managed identity** for Azure OpenAI, Postgres (Entra auth), Blob Storage, and Key Vault.
  The app holds no keys.
- **Postgres Flexible Server B1ms + pgvector**: one server, with separate databases for staging and prod.
- **Container images in GitHub Container Registry**, not Azure Container Registry, which avoids about $5/month.
- **Domain logic in `packages/core`**, which stays framework-free so it is unit-testable and shared with `evals/`.

## Alternatives rejected
- **Static Web Apps Free with managed Functions**: managed Functions cannot use managed identity, and linking a
  standalone Function App requires the Standard plan (about $9/month).
- **Standalone Function App plus a static frontend**: sign-in across two domains adds complexity without a benefit for v1.

## Consequences
- Scale to zero means the first request after an idle period is slow (a cold start of a few seconds). That is
  acceptable for a portfolio app.
- Azure Functions is not used in v1. If background work appears (for example batch re-scoring), add a Function then.
