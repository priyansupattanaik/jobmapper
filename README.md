# Job Mapper 🗺️💼

**Job Mapper** is a source-grounded, auditable, geospatial job discovery platform. It discovers employment opportunities from legally accessible and authentic sources (official employer career pages, verified ATS feeds, and public government employment portals), normalizes and geocodes them, detects and groups duplicates, assesses data quality and freshness, and displays them on a fast, interactive map.

---

## Core Product Principle

> **Accuracy > Trust > Freshness > Coverage > AI convenience**
>
> **NEVER FABRICATE DATA:** Job Mapper never invents job titles, companies, salaries, locations, coordinates, descriptions, or URLs. If a field cannot be reliably determined from an authentic source, it is marked as `Unknown` / `null`. Every single displayed job has a verifiable, traceable source provenance.

---

## Features

- **Interactive Map Experience**:
  - Powered by Leaflet with OpenStreetMap / CartoDB tiles.
  - Marker clustering at high zoom-out levels for smooth performance.
  - Category-based pin colors and customizable radius visualizer circle (2 km, 5 km, 10 km, 25 km, 50 km).
  - "Search this area" viewport querying when panning or zooming.
  - User geolocation ("Near Me") with distance calculation to every job.
- **Natural Language Search**:
  - Translates natural queries (e.g., *"Python developer in Mumbai within 10 km"*, *"Remote data analyst paying above 8 lakh"*) into validated structured filters.
  - Transparent ranking formula combining relevance, proximity, freshness, and source reliability.
- **Multi-Faceted Filtering**:
  - Filter by work mode (Remote, Hybrid, On-site), employment type (Full-time, Contract, Internship, etc.), experience level, category, salary minimum, and freshness.
- **Source Provenance & Auditability**:
  - Every job retains its raw source record unaltered.
  - Transformation history and audit logs are recorded for every lifecycle stage.
  - Direct "Apply on Original Source" link pointing to the authentic employer page.
- **Deduplication Engine**:
  - Deterministic hash matching + token similarity.
  - Seniority safeguards (ensures "Software Engineer" and "Senior Software Engineer" are never merged).
  - Groups duplicate postings across multiple portals and highlights: *"Also listed on X other sources"*.
- **Freshness & Verification Engine**:
  - SSRF-safe URL accessibility verification.
  - Detects dead pages (404/410) and automatically marks listings as `EXPIRED`.
  - Configurable freshness scoring (Fresh: 0-3d, Recent: 4-7d, Aging: 8-30d, Stale: 31d+).
- **Anti-Hallucinatory AI Categorization**:
  - Pluggable `AIProvider` (Google Gemini API with deterministic rule-based offline fallback).
  - Classifies jobs strictly into 26 controlled taxonomy categories.
  - Never modifies or overwrites factual source attributes.
- **Internal Admin Dashboard (`/admin`)**:
  - Monitor source connector health, discovered/accepted/rejected counts, and crawl logs.
  - Trigger live ingestion runs on-demand.
  - Manually re-verify jobs.
  - Review and resolve user-submitted problem reports.

---

## System Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                    User Interface Layer                     │
│    Next.js 14 App Router, React, Tailwind CSS, Leaflet Map  │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / REST API
┌──────────────────────────────▼──────────────────────────────┐
│                    API & Services Layer                     │
│   /api/jobs  /api/jobs/nearby  /api/search  /api/admin/*    │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                   Data Processing Pipeline                  │
│  ┌───────────────────────┐       ┌───────────────────────┐  │
│  │ Source Connectors     │ ----> │ Raw Source Store      │  │
│  │ (Greenhouse, Lever,   │       │ (Immutable JSON)      │  │
│  │  Arbeitnow, Remotive, │       └───────────┬───────────┘  │
│  │  USAJobs Gov API)     │                   │              │
│  └───────────────────────┘                   ▼              │
│                                  ┌───────────────────────┐  │
│                                  │ Normalizer & Resolver │  │
│                                  └───────────┬───────────┘  │
│                                              ▼              │
│                                  ┌───────────────────────┐  │
│                                  │ Geocoder (OSM + Acc)  │  │
│                                  └───────────┬───────────┘  │
│                                              ▼              │
│                                  ┌───────────────────────┐  │
│                                  │ Deduplication Engine  │  │
│                                  └───────────┬───────────┘  │
│                                              ▼              │
│                                  ┌───────────────────────┐  │
│                                  │ AI Classifier (Zod)   │  │
│                                  └───────────┬───────────┘  │
│                                              ▼              │
│                                  ┌───────────────────────┐  │
│                                  │ URL & Freshness Check │  │
│                                  └───────────┬───────────┘  │
└──────────────────────────────────────────────┼──────────────┘
                                               │
┌──────────────────────────────────────────────▼──────────────┐
│                   Storage & Database Layer                  │
│       PostgreSQL + PostGIS (Production DATABASE_URL)        │
│          Spatial SQLite + LibSQL (Zero-Config Dev)          │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Architecture

Job Mapper utilizes a **Dual-Engine Spatial Architecture**:
1. **Production (PostgreSQL + PostGIS)**:
   - When `DATABASE_URL` is set to a PostgreSQL connection string, the system automatically uses PostGIS geometry columns (`geography(Point, 4326)`), spatial GIST indexes, and native spatial queries (`ST_DWithin`, `ST_Distance`).
2. **Local Development & Testing (Spatial SQLite)**:
   - When `DATABASE_URL` is unset, the system uses embedded SQLite via `@libsql/client` with 2D spatial bounding box indexing and spherical Haversine trigonometric distance queries. Zero external dependencies required.

### Database Schema Tables
- `sources`: Tracks connector health, reliability score, discovered/accepted counts, error logs.
- `raw_source_records`: Immutable store preserving untouched raw JSON from external APIs.
- `companies`: Entity resolution table canonicalizing employer names and alias variations.
- `jobs`: Normalized job table containing titles, coordinates, accuracy ratings, salaries, duplicate groups, and confidence scores.
- `job_audit_logs`: Traceability log tracking every transformation stage and worker/model actor.
- `job_reports`: Stores user problem reports for moderation review.

---

## Getting Started

### Prerequisites
- Node.js >= 18.x (tested on Node v24.x)
- npm >= 9.x

### 1. Installation
```bash
git clone <repository-url>
cd jobmapper
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
*(No external API keys are required to run locally. Geocoding defaults to OpenStreetMap Nominatim and AI defaults to the deterministic rule-based classifier).*

### 3. Initialize Database
Run database migrations:
```bash
npm run db:migrate
```

### 4. Ingest Live Verified Jobs
Run the ingestion pipeline to discover real jobs from configured verified connectors:
```bash
npm run ingest
```

### 5. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.
Open [http://localhost:3000/admin](http://localhost:3000/admin) to view the Admin Dashboard.

---

## Automated Test Suites

Job Mapper includes extensive automated tests including unit tests and the dedicated **Section 40 Data-Quality Accuracy Suite**:

```bash
# Run all tests
npm test

# Run dedicated 14-scenario accuracy test suite
npm run test:accuracy
```

### 14 Accuracy Test Scenarios Tested:
1. Multi-source deduplication (strongest primary selected).
2. Seniority separation (Junior vs Senior roles never merged).
3. Missing salary non-fabrication (undisclosed salaries marked Unknown).
4. Missing location non-fabrication (coordinates set to null, accuracy marked unknown).
5. Invalid URL detection and rejection.
6. Expired job detection (dead links marked EXPIRED).
7. Remote job coordinate isolation (no fake coordinates assigned).
8. Hybrid job physical coordinate preservation.
9. Multiple company name variation resolution to canonical entity.
10. Geocoding failure safe fallback without guessing.
11. Identical descriptions across distinct companies stay separated.
12. Missing posted dates handled safely.
13. Login wall detection.
14. Source failure isolation (failing source logs error; other sources proceed).

---

## Production Build & Deployment

To generate an optimized production build:
```bash
npm run build
npm start
```

Deployable to **Vercel**, **Netlify**, **Render**, **AWS**, or any container platform supporting Node.js or Docker.
