# Schedule Maker

A local-first tool for scheduling participant work shifts and matching coach availability.

## Quick Start

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (typically `http://localhost:5173`).

## What It Does

- **Participants** — name, site, weekly working/coaching hour targets, authorization date range
- **Coaches** — name, starting location, per-day availability windows
- **Weekly schedule** — click time slots to create shifts; toggle solo vs coached; assign coaches with live availability hints
- **Hours overview** — track scheduled vs required hours per participant for the current week
- **Conflict warnings** — authorization range, coach availability, double-booking

Data persists in your browser via localStorage. Sample data loads on first visit.

## Approach

This MVP prioritizes **fast editing** and **visibility** over automation:

1. Week-centric calendar grid (how schedulers think)
2. Participant selector with live hour counters
3. Coach availability sidebar when planning coached shifts
4. Inline shift editor for quick adjustments (late/early, reassignments, notes)

Future directions: drag-and-drop shifts, multi-participant view, auto-suggest optimal slots, export/print, backend sync.
