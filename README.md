# RecruiterIQ Prototyp

Funktionsfähiger Prototyp eines Recruiting Intelligence OS mit 10 Modulen als interaktives Dashboard.

## Start

```bash
node src/server.mjs
```

Dann im Browser: http://localhost:3000

## Tests

```bash
node --test tests/*.test.mjs

Enthält lokale Server-Tests **und** Serverless-API-Tests für `api/[...route].mjs`.
```

## Abgedeckte Module

1. Deal-Probability Score (`/api/pipeline/*`, Ansicht `/pipeline`)
2. Next-Best-Message Copilot (`/api/copilot/*`)
3. Ghosting-Frühwarnung (`/api/alerts/ghosting/*`)
4. Hiring Manager Quality (`/api/hiring-managers/*`)
5. Talent-Market Heatmap (`/api/market/*`)
6. Search-to-Shortlist Agent (`/api/agent/*`)
7. Interview Intelligence (`/api/interviews/*`)
8. Compensation-Fit Predictor (`/api/compensation/*`)
9. Silver-Medal Re-Activation (`/api/silver-medals/*`)
10. Outcome-Based Dashboard (`/api/dashboard/*`)

Alle API Responses folgen `{ success, data, error? }`.
