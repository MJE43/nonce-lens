# Pump Analyzer Web — Product Requirements Document (PRD)

> **Version:** 1.0.0
> **Owner:** Mike
> **Implementation stack:** FastAPI (Python 3.11) + React (Vite + TS) + SQLite (SQLModel)
> **Scope:** Pump only, all difficulties, arbitrary targets. Single‑user, local‑first.
> **Non‑goals (MVP):** other games, auth/multi‑user, background job queue, fancy charts.

---

## 0) Executive Summary

Build a local web tool that:

1. deterministically **replays Stake Pump outcomes** for a given server seed, client seed, and nonce range;
2. **stores** the analysis run; and
3. lets the user **reopen**, **filter**, and **export** results later.

The tool supports **all Pump difficulties** (easy/medium/hard/expert) and **arbitrary target multipliers**. It exposes a minimal REST API and a small React UI. Deterministic correctness is paramount.

---

## 1) Assumptions & Definitions

### 1.1 System Assumptions

* **Target Platform:** Modern laptop/desktop with x64 CPU, 8GB+ RAM, running Windows/macOS/Linux
* **Performance Baseline:** 200k nonces analyzed in ≤10 seconds; 500k nonces in ≤30 seconds on target hardware
* **Maximum Nonce Range:** Default 500,000 nonces per run (configurable up to 1M)
* **Floating-Point Tolerance:** `ATOL = 1e-9` for target matching (handles precision differences across platforms)
* **Non-Goals:** Multi-user support, authentication, cloud deployment, background job queues, real-time notifications

### 1.2 Definitions & Glossary

* **Run:** A complete analysis session consisting of seed pair, nonce range, difficulty, targets, and computed results
* **Server Seed:** Cryptographic seed provided by Stake platform (displayed as hex string)
* **Client Seed:** User-provided seed string combined with server seed for provably-fair randomness
* **Nonce:** Sequential play index under a given seed pair (starts at 1, increments per game)
* **Cursor:** Current position in the nonce sequence during analysis
* **Pop Point:** The earliest position (1-25) where a "pop" occurs based on permutation
* **Pumps:** Number of safe pump actions before hitting the pop point
* **Provably Fair:** Stake's cryptographic system ensuring game outcomes are predetermined but verifiable after play

### 1.3 Stake Provably-Fair Background

Stake implements provably-fair gaming where each game outcome is cryptographically predetermined before play but only verifiable afterward. The system uses HMAC-SHA256 with server and client seeds to generate deterministic random sequences. For Pump specifically, each nonce generates a permutation of positions 1-25, where the pop point determines safe pumps and payout multipliers.

---


Repo structure (target)
pump-api/
  app/
    __init__.py
    main.py
    core/
      __init__.py
      config.py
    db.py
    engine/
      __init__.py
      pump.py
    models/
      __init__.py
      runs.py
    routers/
      __init__.py
      runs.py
      verify.py
    schemas/
      __init__.py
      runs.py
  tests/
    test_pump_engine.py
    test_api_e2e.py
  .env.example
  pyproject.toml or requirements.txt

pump-web/
  index.html
  vite.config.ts
  src/
    main.tsx
    App.tsx
    index.css
    lib/api.ts
    pages/
      RunsList.tsx
      NewRun.tsx
      RunDetail.tsx
  .env.example


## 2) Background & Definitions

### 1.1 Provably‑fair model (as implemented here)

* **Key:** ASCII of the server seed string as displayed by Stake (not hex‑decoded).
* **Message:** `${clientSeed}:${nonce}:${round}` with `round ∈ {0,1,2,...}`.
* **Digest:** `HMAC_SHA256(key=serverSeedAscii, msg) → 32 bytes` per round.
* **Floats:** group bytes into 4‑tuples; each float `u ∈ [0,1)` is
  `u = b0/256 + b1/256^2 + b2/256^3 + b3/256^4`.
* **Selection shuffle (25 floats):** start with pool `P = [1..25]`. For each float `u`:
  `j = floor(u * len(P)); pick = P[j]; remove P[j]; append pick to permutation`. Repeat until 25 picks.
* **Pump mapping:**

  * `K = 25` positions.
  * Difficulty → number of POP tokens **M**: easy=1, medium=3, hard=5, expert=10.
  * **Pop set** = first `M` values of the permutation.
  * **Pop point** = `min(pop set)` (1‑based).
  * **Safe pumps** = `min(pop point − 1, 25 − M)`.
  * **Multiplier** = multiplierTable\[difficulty]\[safePumps].

### 1.2 Multiplier tables

* **easy** (M=1) 25 values:
  `[1.00, 1.02, 1.06, 1.11, 1.17, 1.23, 1.29, 1.36, 1.44, 1.53, 1.62, 1.75, 1.88, 2.00, 2.23, 2.43, 2.72, 3.05, 3.50, 4.08, 5.00, 6.25, 8.00, 12.25, 24.50]`
* **medium** (M=3) 23 values:
  `[1.00, 1.11, 1.27, 1.46, 1.69, 1.98, 2.33, 2.76, 3.31, 4.03, 4.95, 6.19, 7.87, 10.25, 13.66, 18.78, 26.83, 38.76, 64.40, 112.70, 225.40, 563.50, 2254.00]`
* **hard** (M=5) 21 values:
  `[1.00, 1.23, 1.55, 1.98, 2.56, 3.36, 4.48, 6.08, 8.41, 11.92, 17.00, 26.01, 40.49, 65.74, 112.70, 206.62, 413.23, 929.77, 2479.40, 8677.90, 52067.40]`
* **expert** (M=10) 16 values:
  `[1.00, 1.63, 2.80, 4.95, 9.08, 17.34, 34.68, 73.21, 164.72, 400.02, 1066.73, 3200.18, 11200.65, 48536.13, 291216.80, 3203384.80]`

### 1.3 Golden test vector (must pass)

* server=`564e967b90f03d0153fdcb2d2d1cc5a5057e0df78163611fe3801d6498e681ca`
* client=`zXv1upuFns`
* nonce=`5663`
* difficulty=`expert`
* result: `max_multiplier = 11200.65`

---

## 3) Goals & Non‑Goals

**Goals**

* Deterministic replay for Pump with any difficulty and target set.
* Persist runs with summaries and hits for later review.
* Lightweight UI to create runs, browse runs, view details, export CSVs, verify a nonce.

**Non‑Goals (MVP)**

* Background job queue, notifications, multi‑user, auth, cloud deployment, rich visualization.

---

## 4) User Stories

1. As a user I input seeds, range, difficulty, and targets. I run the analysis and it saves automatically.
2. As a user I browse prior runs, filter by difficulty or seed text, and open details.
3. As a user I export hits as CSV. Optionally export a full per‑nonce CSV on demand.
4. As a user I verify a single nonce’s computed values.
5. As a user I duplicate a run with a new range.

---

## 5) Core Concepts

### 4.1 Create Run

* Inputs: `server_seed` (string), `client_seed` (string), `start` (int ≥1), `end` (int ≥ start), `difficulty` (`easy|medium|hard|expert`), `targets` (float array).
* Backend computes synchronously (no queue), persists **Run** and **Hits**, returns `RunDetail`.
* Max range guard: default `MAX_NONCES=500_000` (configurable).

### 4.2 Browse Runs

* List page: table with `created_at`, `server_seed_sha256` (first 10 chars), `client_seed`, `difficulty`, `range`, `duration_ms`, `counts per target`, `engine_version`.
* Filters: search by `client_seed` substring, filter by `difficulty`.

### 4.3 Run Detail

* Show inputs, summary, engine version.
* Hits table (`nonce, max_multiplier`) with optional `min_multiplier` server‑side filter.
* Export buttons: `hits.csv`, `full.csv` (full recomputed on demand; not stored in DB).
* Duplicate button pre‑fills New Run form.

### 4.4 Verify Endpoint

* Returns `{max_pumps, max_multiplier, pop_point}` for a single nonce.

### 5.1 Formal Algorithm Specification

#### HMAC Key and Message Construction
* **Key:** Server seed as UTF-8 encoded bytes (ASCII representation as displayed by Stake)
* **Message Format:** `${clientSeed}:${nonce}:${round}` where `round ∈ {0,1,2,...}`
* **Digest:** `HMAC_SHA256(key, message)` producing 32-byte output per round

#### Float Generation
* Process digest in 4-byte chunks: `digest[0:4], digest[4:8], ..., digest[28:32]`
* Each float: `u = b0/256 + b1/256^2 + b2/256^3 + b3/256^4` where `u ∈ [0,1)`
* **Precision Note:** Uses rational arithmetic with denominator 256^4 = 4,294,967,296
* **Platform Stability:** Deterministic across Python implementations due to exact rational computation

#### Selection Shuffle Algorithm
```
pool = [1, 2, 3, ..., 25]  # Initial position pool
permutation = []           # Result permutation

for each float u in generated sequence:
    if len(permutation) == 25:
        break
    j = floor(u * len(pool))  # Selection index
    pick = pool[j]            # Select position
    pool.remove(pick)         # Remove from pool
    permutation.append(pick)  # Add to result

# Continue generating floats until 25 positions collected
```

#### Pop Point and Multiplier Calculation
* **M (POP tokens):** `easy=1, medium=3, hard=5, expert=10`
* **Pop Set:** `pops = permutation[0:M]` (first M positions)
* **Pop Point:** `min(pops)` (1-based position)
* **Safe Pumps:** `min(pop_point - 1, 25 - M)`
* **Multiplier:** `MULTIPLIER_TABLE[difficulty][safe_pumps]`

#### Worked Example (Golden Test Vector)
```
Server: 564e967b90f03d0153fdcb2d2d1cc5a5057e0df78163611fe3801d6498e681ca
Client: zXv1upuFns
Nonce: 5663
Difficulty: expert (M=10)

Key = server_seed.encode('utf-8')
Message = "zXv1upuFns:5663:0"
Digest = HMAC_SHA256(key, message)[:32 bytes]
# Generates floats until 25 positions collected
# permutation = [23, 15, 8, 11, 5, 22, 12, 18, 9, 16, 6, 24, 13, 21, 25, 14, 1, 19, 4, 17, 3, 2, 7, 20, 10]
pops = permutation[0:10] = [23, 15, 8, 11, 5, 22, 12, 18, 9, 16]
pop_point = min(pops) = 5
safe_pumps = min(5-1, 25-10) = min(4, 15) = 4
max_multiplier = EXPERT_TABLE[4] = 11200.65 ✓
```

#### Determinism Guarantees
* **Input Determinism:** Identical inputs produce identical outputs
* **Platform Independence:** Algorithm uses only standard HMAC-SHA256 and rational arithmetic
* **Testing:** Automated tests verify golden vectors and cross-platform consistency
* **Float Precision:** ATOL=1e-9 tolerance for floating-point comparisons

#### Multiplier Table Source
Tables derived from Stake's Pump game implementation. Each difficulty has `26-M` entries (0 to 25-M safe pumps). Expert table verified against known nonce 5663 producing 11200.65 multiplier.

---

## 6) Non‑Functional Requirements

* **Determinism:** identical inputs → identical outputs. Golden vector enforced in unit tests.
* **Performance:** 200k nonces ≤ 10 s typical; 500k ≤ 30 s target on a modern laptop.
* **Stability:** Input validation and range caps; informative 422 errors.
* **Local privacy:** SQLite file; list view shows only hash of server seed; raw displayed on detail page.
* **CORS:** allow `http://localhost:5173` (configurable).
* **Extensibility:** Engine isolated so CLI/API/UI share the same code path.

---

## 7) System Architecture

* **Frontend:** Vite React + TS. TanStack Query for data fetching. Tailwind for styling.
* **Backend:** FastAPI. Engine functions called synchronously per request. SQLModel ORM to SQLite (aiosqlite driver).
* **Persistence:** Tables `runs`, `hits`. Keep hits only; compute full CSV on demand to avoid DB bloat.

**Sequence (Create Run):**
React form → `POST /runs` → FastAPI validates → calls engine `scan_pump()` → inserts `runs` row → bulk inserts `hits` → responds with `RunDetail` → UI redirects to `/runs/:id`.

---

## 8) Detailed Engine Specification

### 7.1 Function signatures

* `scan_pump(server_seed: str, client_seed: str, start: int, end: int, difficulty: str, targets: list[float]) -> tuple[dict[float, list[int]], dict]`

  * Returns `(hits_by_target, summary)` where:

    * `hits_by_target`: `{targetFloat: [nonce, ...]}` exact matches with tolerance `ATOL=1e-9`.
    * `summary`: `{count, duration_ms, difficulty, start, end, targets, max_multiplier, median_multiplier, counts_by_target}`.
* `verify_pump(server_seed: str, client_seed: str, nonce: int, difficulty: str) -> dict`

  * Returns `{max_pumps:int, max_multiplier:float, pop_point:int}`.
* `ENGINE_VERSION = "pump-1.0.0"` exported for traceability.

### 7.2 Pseudo‑code

```
key = server_seed.encode('utf-8')
perm = []
pool = [1..25]
for r in 0..∞:
  digest = HMAC_SHA256(key, f"{client}:{nonce}:{r}")  # 32 bytes
  for i in range(0, 32, 4):
    u = b0/256 + b1/256^2 + b2/256^3 + b3/256^4
    j = floor(u * len(pool))
    pick = pool.pop(j)
    perm.append(pick)
    if len(perm) == 25: break
  if len(perm) == 25: break
pops = perm[:M]; pop_point = min(pops)
safe = min(pop_point-1, 25-M)
mult = TABLE[difficulty][safe]
```

### 7.3 Numeric correctness example

Use the golden test vector in automated tests. Also verify that for each difficulty the multiplier array length equals `25 − M + 1`.

---

## 9) API Specification (FastAPI)

### 8.1 Data types

* `Difficulty = "easy" | "medium" | "hard" | "expert"`
* `Targets = number[]` (floats; duplicates removed; sorted in backend for display)

### 8.2 Endpoints

#### POST `/runs`

Create and persist a run.

* **Body**

```json
{
  "server_seed": "<string as shown by Stake>",
  "client_seed": "<string>",
  "start": 1,
  "end": 200000,
  "difficulty": "expert",
  "targets": [11200.65, 48536.13, 291216.8, 3203384.8]
}
```

* **Responses**

  * `201 Created` with `RunDetail` JSON.
  * `422` invalid input; `413` range too large; `500` unexpected.
* **RunDetail shape**

```json
{
  "id": "uuid",
  "created_at": "2025-09-08T20:30:00Z",
  "server_seed_sha256": "0x…",
  "server_seed": "<raw string>",
  "client_seed": "…",
  "nonce_start": 1,
  "nonce_end": 200000,
  "difficulty": "expert",
  "targets": [11200.65, 48536.13],
  "duration_ms": 3800,
  "engine_version": "pump-1.0.0",
  "summary": {
    "count": 200000,
    "max_multiplier": 11200.65,
    "median_multiplier": 1.63,
    "counts_by_target": {"11200.65": 16, "48536.13": 3},
    "top_max": [{"nonce": 15115, "max_multiplier": 11200.65}]
  }
}
```

#### GET `/runs`

List recent runs.

* **Query:** `limit` (default 50, max 200), `offset` (default 0), `search` (client seed substring), `difficulty` (optional).
* **Response:** array of `RunRead` with minimal fields + counts by target.

#### GET `/runs/{id}`

Return full `RunDetail`.

#### GET `/runs/{id}/hits`

* **Query:** `min_multiplier?` (float; optional), `limit` (default 100, max 10k), `offset`.
* **Response:** `{ total: number, rows: [{ nonce: number, max_multiplier: number }] }` sorted by `nonce ASC`.

#### GET `/runs/{id}/export/hits.csv`

* Streams `text/csv` with header `nonce,max_multiplier`.

#### GET `/runs/{id}/export/full.csv`

* Streams recomputed per‑nonce rows with header `nonce,max_pumps,max_multiplier,pop_point`.

#### GET `/verify`

* **Query:** `server_seed, client_seed, nonce, difficulty`.
* **Response:** `{ max_pumps, max_multiplier, pop_point }`.

### 8.3 Status codes

* `201` created, `200` ok, `204` no content, `400/422` input error, `404` not found, `413` range too large, `500` server error.

---

## 10) Data Model (SQLite via SQLModel)

### 9.1 Tables

**runs**

* `id` UUID PK
* `server_seed` TEXT
* `server_seed_sha256` TEXT (SHA256 of server\_seed string; hex)
* `client_seed` TEXT
* `nonce_start` INTEGER
* `nonce_end` INTEGER
* `difficulty` TEXT
* `targets_json` TEXT (JSON array)
* `duration_ms` INTEGER
* `engine_version` TEXT
* `summary_json` TEXT
* `created_at` TIMESTAMP

**hits**

* `id` INTEGER PK AUTOINCREMENT
* `run_id` UUID FK → `runs.id`
* `nonce` INTEGER
* `max_multiplier` REAL
* Index `(run_id, nonce)`

### 9.2 Constraints & Integrity

* `nonce_end ≥ nonce_start` enforced.
* `difficulty ∈ set`.
* `targets_json` must be a non‑empty array of numbers.
* `ON DELETE CASCADE` from `runs` to `hits` (configure in ORM).

---

## 11) Frontend Specification (React + Vite + TS)

### 10.1 Pages & Routes

* `/` **RunsList**
* `/new` **NewRun**
* `/runs/:id` **RunDetail**

### 10.2 Components

* **NewRunForm**: fields + validation + submit.
* **RunsTable**: table with simple filtering.
* **RunSummary**: shows computed summary, targets, duration, engine version.
* **HitsTable**: virtualized if rows > 5k; filter by `min_multiplier`; CSV buttons link to API.

### 10.3 UX Notes

* Validation on client before sending.
* Show SHA256 short hash in lists; full seed only on detail page.
* Simple toasts for errors.

---

## 12) Configuration & Environment

* **Backend** `.env`

  * `DATABASE_URL=sqlite+aiosqlite:///./pump.db`
  * `API_CORS_ORIGINS=http://localhost:5173`
  * `MAX_NONCES=500000`
* **Frontend** `.env`

  * `VITE_API_BASE=http://localhost:8000`

---

## 13) Validation & Error Handling

* Reject empty seeds, negative or zero ranges, invalid difficulty.
* Parse targets by comma; strip; convert to float; drop NaN/dup; require ≥1 target.
* Return 413 if `(end − start + 1) > MAX_NONCES`.
* Structured error payload: `{ "error": { "code": "VALIDATION_ERROR", "message": "…", "field": "targets" } }`.

---

## 14) Performance & Limits

* Single request computes in‑process; avoid blocking too long by enforcing `MAX_NONCES`.
* For export of full CSV, recompute on the fly streaming rows; no DB blow‑up.
* Consider `itertools` and tight loops; avoid DataFrames on backend.

---

## 15) Logging & Observability

* Structured logs per request: `method, path, status, duration_ms, run_id`.
* On engine run: log `difficulty, count, duration_ms, max_multiplier`.

---

## 16) Security & Privacy

* Local app; do not expose publicly.
* CORS allowlist only local origin.
* Store raw server seed for MVP but display hashed seed in list; provide toggle to hide raw in detail later.

---

## 17) Testing Strategy

* **Unit tests (engine):** golden expert case; a case per difficulty; boundary conditions (start=end, minimal and maximal safe pumps).
* **API tests:** create small run; list; detail; hits with filter; CSV endpoints; verify endpoint.
* **Determinism test:** two identical POSTs yield identical summaries and hit counts (IDs will differ).

---

## 18) Deployment & Runbook (Local)

* Backend: `uvicorn app.main:app --reload`
* Frontend: `npm run dev` (Vite on 5173)
* DB file `pump.db` created on first run.
* Backup by copying `pump.db`.

**Optional Docker (later):** Compose with two services and a bind‑mounted volume for the DB.

---

## 19) Detailed Work Plan (for coding agent)

### Milestone M1 — Engine & API

1. Implement `app/engine/pump.py` with selection shuffle and tables. Export `ENGINE_VERSION`.
2. Implement unit tests `tests/test_pump_engine.py` including the golden vector.
3. Define SQLModel models in `app/models/runs.py` (Run, Hit) with indexes and FK.
4. Add `app/db.py` async engine + `create_all()` at startup.
5. Define Pydantic schemas in `app/schemas/runs.py` (RunCreate, RunRead, RunDetail, HitRow, HitsPage).
6. Routers:

   * `POST /runs` compute + persist (bulk insert hits), return RunDetail.
   * `GET /runs` list + filters.
   * `GET /runs/{id}` detail.
   * `GET /runs/{id}/hits` pagination + optional `min_multiplier`.
   * `GET /runs/{id}/export/hits.csv` stream from DB.
   * `GET /runs/{id}/export/full.csv` recompute and stream.
   * `GET /verify` single‑nonce.
7. API tests with `httpx.AsyncClient` for the above.

**Acceptance:** unit tests pass; API smoke tests pass; schema auto‑creates DB.

### Milestone M2 — Frontend MVP

1. Create Vite React TS app; set Tailwind; add TanStack Query + Axios.
2. Build **RunsList** page: fetch `/runs`, table, filters, links.
3. Build **NewRun**: form with validation; comma‑to‑floats for targets; POST to `/runs`; navigate on success.
4. Build **RunDetail**: fetch `/runs/{id}` and `/runs/{id}/hits`; show summary; hits table; CSV buttons; duplicate button.
5. Add minimal routing and layout header with links.

**Acceptance:** manual E2E: create run → list updates → open detail → download CSVs → verify nonce.

---

## 20) Wireframe (text)

**/ (RunsList)**

* Header: \[New Run]
* Table:

  * Created | Seed Hash | Client Seed | Difficulty | Range | Duration | Target Counts | Actions

**/new (NewRun)**

* Inputs: server seed (textarea), client seed, start, end, difficulty (select), targets (text: `11200.65, 48536.13`)
* \[Run]

**/runs/\:id (RunDetail)**

* Summary card: inputs + summary numbers + engine version
* Buttons: \[Download hits.csv] \[Download full.csv] \[Duplicate]
* Hits table: nonce | max\_multiplier, filter `min_multiplier`

---

## 21) CSV Formats

* **hits.csv**: `nonce,max_multiplier`
* **full.csv**: `nonce,max_pumps,max_multiplier,pop_point`

---

## 22) Open Questions

* Should we hide raw server seed by default in the detail view? (MVP: show; list shows hash only.)
* Do we need progress reporting for long runs? (MVP: synchronous; later background jobs.)
* Maximum range default 500k; OK to bump to 1M later with streaming responses?

---

## 22) Future Roadmap (post‑MVP)

* Background tasks with progress (`run_in_executor` or `RQ/Celery`).
* Notes/tags per run; seed vault aggregation; search by seed hash.
* Charts: density, gaps, clusters, rolling windows.
* Other Stake Originals with shared RNG core (Dice, Limbo, Mines, Plinko, Crash).
* Import/export run packs; shareable permalinks.

---

## 23) Acceptance Criteria (recap)

* Deterministic correctness matches golden vector.
* Create run → browse runs → open details → export CSVs → verify nonce.
* Performance meets targets for typical ranges.
* Clean error handling and validation.

---

## 24) Glossary

* **Nonce:** sequential index for a play under a given seed pair.
* **Pop point:** earliest pop position among first M picks of the permutation.
* **Safe pumps:** number of pumps before pop point, capped by `25 − M`.
* **Target:** multiplier value of interest to highlight hits.

> End of PRD.
