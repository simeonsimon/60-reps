# Logging habits from Apple Reminders

Tick reminders on your phone like normal. Once a night a Shortcut sweeps up what
you completed and writes it to this repo; the app folds it in the next time you
open it.

Verified working end to end on iOS 26.6, 2026-09-12.

## Why it works this way

Three iOS limits shape the design. Each one killed an earlier version, so they
are worth knowing before you try to "improve" it:

- **Shortcuts has no "reminder completed" trigger.** The automation triggers are
  time of day, alarm, sleep, workout, NFC, focus, charger and so on. Nothing
  fires when you tick a reminder, so the sweep has to be pulled on a schedule.
- **iOS ignores web-push action buttons.** Only "View" renders, so a "Done"
  button on the reminder notification isn't available either.
- **`Find Reminders` date filters accept a literal date only — no variables.**
  The Shortcut therefore cannot ask for "completed today". It sweeps everything
  completed and stamps each line with its own date; the grouping happens in the
  app, where it is testable.

The app's data also can't be written from outside the browser, which is why the
sweep goes through the repo rather than straight into the app.

## One-time setup

### 1. A Reminders list called `Habits`

Make a list named exactly **`Habits`** and add a repeating reminder per habit.
**The reminder title must match the habit title in the app.** Matching ignores
case, accents, emoji and punctuation — `Leer 20 páginas 📚` matches a habit
called `Leer 20 paginas` — but nothing cleverer than that. Anything unmatched is
listed in *Settings → Sync*.

A habit with no reminder never syncs. If you add habits later, add reminders too.

### 2. A GitHub token

github.com → Settings → Developer settings → **Fine-grained tokens** → Generate:

- **Repository access:** *Only select repositories* → `simeonsimon/60-reps`.
  Not "Public repositories" — that is read-only and cannot write.
- **Permissions:** *Repository permissions* → **Contents** → **Read and write**.
  It defaults to "No access" and is easy to scroll past.
- **Expiration:** a year. The 30-day default expires silently, and the only
  symptom is that syncing quietly stops.

Paste it into the app under **Settings → Sync**, and into the Shortcut below. It
lives only on your device — never in the app's code, which matters because the
app is served from public GitHub Pages.

### 3. The Shortcut

One shortcut named **Sweep habits**, 14 actions. This is the configuration that
actually works; earlier drafts of this file described several that don't.

Turn **Smart Punctuation off** first (Settings → General → Keyboard).

```
 1  Format Date      Current Date
                     Date Format    Custom
                     Format String  yyyyMMddHHmmss
                     Locale         Default
 2  Set Variable     RUNSTAMP

 3  Find Reminders   where All of the following are true
                     List  is  Habits
                     Is Completed
                     (no date filter - see below)

 4  Repeat with each item in  Reminders
 5      Format Date  Repeat Item > Completion Date
                     Format String  yyyy-MM-dd
 6      Text         <Formatted Date>|<Repeat Item > Name>
 7      Add to Variable   MATCHED        value: <Text>
 8  End Repeat

 9  Count  Items  in  MATCHED
10  If  Count  is greater than  0
11      Combine  MATCHED  with  New Lines
12      Base64 Encode  Combined Text     Line Breaks: None
13      Get Contents of URL
              https://api.github.com/repos/simeonsimon/60-reps/contents/inbox/sweep-<RUNSTAMP>.txt
              Method        PUT
              Headers       Authorization         Bearer <token>
                            Accept                application/vnd.github+json
                            X-GitHub-Api-Version  2022-11-28
              Request Body  JSON
                            message  (Text)  sweep
                            content  (Text)  <Base64 Encoded>
                            branch   (Text)  main
14  End If
```

Anything in angle brackets above is an **inserted variable**, not typed text. In
the app it renders as a coloured pill. Typing the word instead is the single
most common way to break this.

#### The fiddly parts

- **Naming variables.** You cannot name an action's output from that action — a
  magic variable is renameable only from somewhere it is already used. Use an
  explicit `Set Variable` action, as in step 2.
- **`RUNSTAMP` must come from `Current Date`,** not from another formatted
  string. Feeding it an already-formatted date pins it to midnight, so every run
  that day produces the same filename and the second one fails with 422.
- **Casing matters.** Lowercase `yyyy` (uppercase `YYYY` is week-based year and
  breaks in early January), `MM` month, `mm` minutes, `HH` 24-hour.
  Autocapitalize will try to give you `Yyyy`.
- **Steps 5-7 must sit inside the Repeat**, indented. If they slip below
  `End Repeat` the loop body is empty and nothing accumulates.
- **`Add to Variable`, not `Set Variable`** — `Set` overwrites on every pass and
  leaves you with a single item.
- **Both `Repeat Item` references need a property picked.** Insert the variable,
  then tap the pill: `Completion Date` in step 5, `Name` in step 6.
- **Use `Request Body: JSON`, not `File`.** Handing `File` a Text variable sends
  multipart form data instead of a JSON body; GitHub answers with something
  Shortcuts can't read and you get *"cannot parse response"*.
- Spanish region with English language is fine — both format strings are pure
  numbers, so `Locale: Default` is correct.

### 4. The nightly automation

Shortcuts → **Automation** → **+** → **Time of Day** → **23:50** → Daily → run
**Sweep habits** → **Ask Before Running: OFF**. It won't run silently otherwise.

Also add the shortcut to a Home Screen widget so you can force a sweep after a
late tick.

## How it behaves

The uploaded file is one line per completed reminder:

```
2026-09-12|Wash teeth Night
2026-09-12|Leer 20 páginas
2026-09-12|Journal
```

- **Re-running is safe.** Applying a sweep is idempotent: `profile.syncedTicks`
  records how many ticks a day contributed, so replaying a file changes nothing.
- **In-app taps aren't double counted.** For daily and multi habits, the reps
  already logged that day act as a floor.
- **Reps land on the day you ticked them**, not on sweep night, so streaks and
  the heatmap stay correct. Ticks from earlier days get swept and dated properly
  too.
- **Undated lines are ignored** rather than assumed to be today, so a mis-built
  Shortcut shows up as "nothing synced" and never as reps on the wrong day.
- Sweep files older than 14 days are cleaned up automatically.

## Checking it works

The app syncs on launch and whenever it returns to the foreground.
*Settings → Sync* shows what happened; **Sync now** forces a pull.

The merge logic has tests:

```bash
npm test
```

## Debugging

**Read the uploaded file, not the Shortcut UI.** Temporarily delete the
`If Count > 0` guard (action 10) so it always uploads, run it, then look in
`inbox/`. A 0-byte file, a file of bare names, and a file of dated lines each
point at a different layer. This is much faster than inspecting actions.

**Every GitHub failure has a distinct response shape:**

| Response | Cause |
|---|---|
| `401 Requires authentication` | no `Authorization` header |
| `401 Bad credentials` | token wrong — angle brackets left in, trailing space, expired |
| `404` + generic `documentation_url: docs.github.com/rest` | URL matches no route, e.g. `/content/` instead of `/contents/` |
| `404` + `...#get-repository-content` | a **GET** on a missing file — the Method isn't PUT |
| `404` + `...#create-or-update-file-contents` | right endpoint, wrong owner/repo |
| `404 Branch x not found` | wrong branch |
| `422 sha wasn't supplied` | that filename already exists — `RUNSTAMP` isn't unique |
| *cannot parse response* | `Request Body` is `File`; switch it to `JSON` |

A **PUT never 404s because the file is missing** — PUT creates it. So a 404 on
the upload is never about the path.

| Symptom | Cause |
|---|---|
| Outputs `0`, nothing uploads | `MATCHED` is empty — the loop found nothing, or `Add to Variable` isn't wired to the `Text` |
| Uploads a 0-byte file | same, with the `If Count > 0` guard removed |
| A reminder shows as unmatched in the app | its title doesn't match any habit title |
| "Please choose a value for each parameter" | a blank leftover `Condition` or header row — delete it with its minus button |
| Nothing syncs overnight | the automation has *Ask Before Running* on, or the list isn't named `Habits` |
