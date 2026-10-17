# Aria

Pre-incident world models for first responders. Aria runs an AI agent against a building —
Street View, FEMA flood zones, NOAA surge data, nearby infrastructure — and produces a
30-second size-up a battalion chief can act on, alongside a LiDAR scan that floods under a
storm-surge slider to show which exits stay open.

## Pages

| Route             | What it is                                                                 |
| ----------------- | -------------------------------------------------------------------------- |
| `/`               | Landing page with the animated Gulf-coast globe                            |
| `/dashboard`      | Mapbox 3D map of Miami-Dade with pre-planned buildings and recent runs     |
| `/building/[id]`  | Agent log · 3D LiDAR scan (mesh / evac / hazard pins + surge) · report     |

## Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · Framer Motion · Mapbox GL ·
Three.js · Supabase

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev
```

### Environment

| Variable                        | Purpose                                                   |
| ------------------------------- | --------------------------------------------------------- |
| `NEXT_PUBLIC_MAPBOX_TOKEN`      | Mapbox public token for the dashboard map                 |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL (buildings, preplans, scans bucket)  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key                                         |
| `NEXT_PUBLIC_AGENT_API_URL`     | Agent backend that streams runs over SSE                  |

Without Supabase configured the app falls back to the seeded demo building
(The Dock, 400 NW 26th St), so the dashboard and building page still render.

### Database

Run the migrations in `infra/supabase/migrations` in order against your Supabase project.

### Agent API

The building page talks to an agent service that streams Server-Sent Events:

- `POST /agent/replay/:buildingId` — replay the cached run for a building
- `POST /agent/run` — `{ address, scenario_params, building_id }` → live run

Events: `thinking`, `reasoning`, `tool_call`, `tool_result`, `complete` (with the
`report`), and `error`.
