# WP 521–540 — App Store, Release & Betriebssicherheit

## Module

| Bereich | Route | Kernfunktion |
|---------|-------|--------------|
| Hub | `/business/release` | Version Manifest, Env-Profile, KPIs |
| Liste | `/business/release/list` | Release-Pakete & Checklisten |
| Detail | `/business/release/[id]` | Deployment-Checkliste (toggle) |
| Anlegen | `/business/release/create` | Neues Release-Paket |

## Permissions

- `release.view` — Lesen
- `release.manage` — Anlegen, Checkliste bearbeiten

## Deliverables

- Typen: `src/types/release/index.ts`
- Demo: `src/data/demo/domains/releaseDemo.ts`
- Service: `src/lib/release/releaseService.ts`
