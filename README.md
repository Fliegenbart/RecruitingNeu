# RecruiterIQ Prototyp

Funktionsfähiger Prototyp eines Recruiting Intelligence OS mit 12 Modulen als interaktives Dashboard.

## Start

```bash
npm run start
# oder (Auto-Reload)
npm run dev
```

Dann im Browser: http://localhost:3000

### Inbox Daten (Prototype Store)

Die Inbox nutzt standardmaessig eine lokale JSON-Datei zur Persistenz:

- `data/db.json` (auto-erstellt)

Optional:

```bash
STORE_PERSIST=0 node src/server.mjs
# oder
DB_PATH=/tmp/recruiteriq-db.json node src/server.mjs
```

## Tests

```bash
npm test
```

Enthält lokale Server-Tests **und** Serverless-API-Tests für `api/[...route].mjs`.

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
11. Bewerbungs-Triage (Claim-to-Evidence, Duplikat-Cluster, Proof-of-Work) (`/api/triage/*`, Ansicht `/triage`)
12. Bewerbungs-Inbox (Pilot: Tenant/Team/Job, Rubriken, Queue) (`/api/pilot/*`, Ansicht `/inbox`)

### Lokale Open-Source Modelle (optional)

Die Triage funktioniert ohne LLM. Fuer "Enrichment" (zusaetzliche Claims/Follow-ups) kann lokal Ollama genutzt werden:

```bash
TRIAGE_USE_OLLAMA=1 OLLAMA_MODEL=llama3.2:3b node src/server.mjs
```

Alle API Responses folgen `{ success, data, error? }`.
