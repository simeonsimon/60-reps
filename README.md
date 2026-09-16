# 60 Reps

A no-guilt habit builder. Every habit is a climb to **60 reps** — miss a day and
the climb simply *pauses*; it never resets. The installable PWA combines a daily
agenda, focused press-and-hold logging with haptics, long-view analytics, and a
premium "Super! Boring" tier.

## Run it locally

```bash
cd 60-reps
npm install
npm run dev
```

Open the printed `http://localhost:5173` URL. State is saved in your browser
(`localStorage`), so your habits and history persist between visits.

## Build for production

```bash
npm run build      # outputs to dist/
npm run preview    # serve the built dist/ to check it
```

## Deploy to GitHub Pages

Deployment is automated by [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).
Every push to `main` (apart from reminder-data-only changes) runs `npm ci` and
`npm run build`, uploads `dist/` as a Pages artifact, and deploys it with GitHub
Actions. The workflow can also be started manually with `workflow_dispatch`.

The build uses relative asset paths (`base: './'`), so the generated app works
on the repository's GitHub Pages project URL. Configure Pages to use **GitHub
Actions** as its source; no manual upload or routing configuration is needed.

## Logging from Apple Reminders

Habits can be ticked in the iPhone Reminders app instead of here. A nightly
Shortcut sweeps completed reminders into this repo and the app folds them in on
launch — which also gets your history out of `localStorage` and into a
versioned backup. Setup steps and the design constraints behind them are in
[docs/reminders-sync.md](docs/reminders-sync.md).

```bash
npm test      # reminder-sync and analytics test suites
```

## What's inside (per the spec)

- **60-rep philosophy** — progress is out of 60; missed days pause, never reset.
- **Tracking modes** — Single Daily, Multi Daily, and numeric Progress (e.g. `40 / 100 throws`).
- **Agenda and focus views** — scan habits by time of day, log directly from
  the agenda, or open the focused card for a single climb.
- **Press & hold** — `pointerdown`/`pointerup` long-press with a charging ring,
  `navigator.vibrate` haptics, and completion feedback.
- **Swipe UI** — a full-viewport Framer Motion carousel in focus mode.
- **Analytics** — gated insights, forecasts, weekly and monthly rollups, a
  canvas climb chart, and an SVG consistency heatmap.
- **Super! Boring tier** (toggle in *Skins & Settings*):
  - **Skins** — Normal · Ledger · Wireframe · Karat · Cedar. Each swaps the
    CSS-variable colour system instantly.
  - **Custom AI Quests** — a procedural story per habit; a new chapter unlocks
    every 5 reps, themed to the habit's title.
  - **Web Audio** — synthesized SFX (no asset files), controlled by a master toggle.
  - **Milestone achievements** — hidden badges (combo taps, midnight logging,
    summit, streaks…) stored in your profile.

## Tech stack

React 18 · Vite · Tailwind CSS v3 · Framer Motion · vite-plugin-pwa.

## Notes

- **Premium is on by default** so you can see everything; toggle it off in
  *Skins & Settings* to preview the free tier (skins/quests lock).
- **Reset** — *Skins & Settings → Reset all data* restores the three seed habits.
- Tailwind's `content` globs and PostCSS plugins are wired to resolve relative to
  the project (in `tailwind.config.js` / `vite.config.js`), so the build works no
  matter which directory you launch it from.
