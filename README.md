# 60 Reps

A no-guilt, 3D habit builder. Every habit is a climb to **60 reps** — miss a day and
the climb simply *pauses*; it never resets. Built to feel like a native app:
full-screen swipeable cards, an embedded low-poly mountain that grows as you log
reps, press-and-hold completion with haptics, and a premium "Super! Boring" tier.

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

## Deploy to GitHub Pages (drag-and-drop)

The build uses **relative asset paths** (`base: './'`), so the `dist/` output
works from any URL — including a GitHub Pages project page.

1. `npm run build`
2. In your GitHub repo, upload the **contents of `dist/`** (the `index.html` and
   the `assets/` folder) — drag them into the repo via *Add file → Upload files*.
3. Settings → Pages → deploy from the branch/folder you uploaded to.

No routing config needed — it's a single-page app with no server-side routes.

## What's inside (per the spec)

- **60-rep philosophy** — progress is out of 60; missed days pause, never reset.
- **Tracking modes** — Single Daily, Multi Daily, and numeric Progress (e.g. `40 / 100 throws`).
- **3D per habit** — `@react-three/fiber` canvas with a flat-shaded low-poly
  mountain. New trees, rocks, towers and a summit flag appear as reps climb.
- **Press & hold** — `pointerdown`/`pointerup` long-press with a charging ring,
  `navigator.vibrate` haptics, a scene scale-pulse, and a 3D particle burst on completion.
- **Swipe UI** — full-viewport Framer Motion carousel, no navbar.
- **Recaps** — a canvas "Climb Chart" of lifetime reps and an SVG GitHub-style
  consistency heatmap.
- **Super! Boring tier** (toggle in *Skins & Settings*):
  - **Skins** — Normal · Wireframe · Karat (gold metallic) · Cedar (wood). Swaps
    Tailwind theme + Three.js materials instantly.
  - **Custom AI Quests** — a procedural story per habit; a new chapter unlocks
    every 5 reps, themed to the habit's title.
  - **Web Audio** — synthesized SFX (no asset files), with a mute-override toggle.
  - **Milestone achievements** — hidden badges (combo taps, midnight logging,
    summit, streaks…) stored in your profile.

## Tech stack

React 18 · Vite · Tailwind CSS v3 · Three.js · @react-three/fiber + drei · Framer Motion.

## Notes

- **Premium is on by default** so you can see everything; toggle it off in
  *Skins & Settings* to preview the free tier (skins/quests lock).
- **Reset** — *Skins & Settings → Reset all data* restores the three seed habits.
- Tailwind's `content` globs and PostCSS plugins are wired to resolve relative to
  the project (in `tailwind.config.js` / `vite.config.js`), so the build works no
  matter which directory you launch it from.
```
