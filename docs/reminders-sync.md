# Logging habits from Apple Reminders

Tick reminders on your phone like normal. Once a night a Shortcut sweeps up
everything you completed and writes it to this repo; the app folds it in the
next time you open it.

## Why it works this way

Two iOS limits shape the whole design, and both are worth knowing before you
try to "improve" it:

- **Shortcuts has no "reminder completed" trigger.** Apple's automation
  triggers are time of day, alarm, sleep, workout, NFC, focus, charger and so
  on — nothing fires when you check a reminder off. So the sweep has to be
  pulled on a schedule; it can't be pushed the moment you tick.
- **iOS ignores web-push action buttons.** Only "View" ever renders, so a
  "Done ✓" button on the reminder notification isn't an option either.

The app's data also can't be written from outside the browser, which is why the
sweep goes through the repo rather than straight into the app.

## One-time setup

### 1. A Reminders list called `Habits`

Make a list named **Habits** and add a repeating reminder per habit. **The
reminder title must match the habit title in the app.** Matching ignores case,
accents, emoji and punctuation — `Leer 20 páginas 📚` matches a habit called
`Leer 20 paginas` — but nothing smarter than that. Anything unmatched shows up
in *Settings → Sync* so you can fix the name.

### 2. A GitHub token

github.com → Settings → Developer settings → **Fine-grained tokens** → Generate:

- **Repository access:** Only select repositories → `simeonsimon/60-reps`
- **Permissions:** Repository permissions → **Contents: Read and write**
- Expiry: whatever you'll remember to rotate

Paste it into the app under **Settings → Sync**. It's stored on that device
only — it is never in the app's code, which matters because the app is served
from public GitHub Pages.

You'll paste the same token into the Shortcut below.

### 3. The Shortcut

New shortcut named **Sweep habits**. It does the same six steps twice — once
for today, once for yesterday.

**Set up the three dates first.** Each one is a pair of actions: format the
date, then store it under a name you can reuse.

> **Naming variables.** Shortcuts won't let you name an action's output from the
> action itself — a magic variable can only be renamed from somewhere it's
> already *used* (tap the blue pill → **Variable Name**). Since nothing
> references these dates yet, use a **Set Variable** action instead: add it,
> tap the name field, type the name. Its input defaults to the previous
> action's output, which is exactly what you want.

| # | Action | Settings |
|---|---|---|
| 1 | `Format Date` | Date: **Current Date** · Format: **Custom** → `yyyy-MM-dd` |
| 2 | `Set Variable` | Name: `TODAY` (input: the Formatted Date above) |
| 3 | `Adjust Date` | **Current Date** · **Subtract** · **1** · **Day** |
| 4 | `Format Date` | Date: the **Adjusted Date** from step 3 · Custom → `yyyy-MM-dd` |
| 5 | `Set Variable` | Name: `YESTERDAY` |
| 6 | `Format Date` | Date: **Current Date** · Custom → `yyyyMMddHHmmss` |
| 7 | `Set Variable` | Name: `RUNSTAMP` |

To set **Custom** format: tap the `Format Date` action, set *Date Format* to
**Custom**, then type the pattern into the *Format String* field that appears.

`RUNSTAMP` is what keeps each night's file unique. Without it, tonight's sweep
of yesterday would collide with last night's sweep of the same day and the
upload would fail.

Everywhere below that names a variable in caps, insert it from the variable
row above the keyboard (or the **Select Variable** button) — don't type the
word literally, or you'll upload a file called `TODAY--RUNSTAMP.txt`.

**Then add this block twice** — once for today, once for yesterday. Build it
for today first, get it working, then duplicate and change the two marked
settings.

- **A. `Find Reminders`** — Filter: `List` is `Habits`, `Is Completed` is `Yes`,
  `Due Date` is **Today**. ← *second pass: **Yesterday***
- **B. `Count`** → **`If`** `Count` is **greater than** `0`. Everything from C
  to F goes *inside* the If, so a day where you ticked nothing can't error the
  automation out.
- **C. `Combine Text`** on the found reminders, Separator: **New Lines**. A
  reminder coerces to its title, so this gives one title per line, repeated if
  you ticked it more than once.
- **D. `Base64 Encode`** the Combined Text. Tap the arrow to expand the action
  and set **Line Breaks: None** — wrapped Base64 is rejected by the API.
- **E. `Text`** action holding the request body. Build it as *Text*, not as a
  `Dictionary` — the dictionary action chokes on larger payloads:
  ```
  {"message":"sweep","content":"BASE64","branch":"main"}
  ```
  where `BASE64` is the Base64 Encoded Text from D, inserted as a variable.
- **F. `Get Contents of URL`**
  - URL — insert `TODAY` and `RUNSTAMP` as variables, type the rest:
    ```
    https://api.github.com/repos/simeonsimon/60-reps/contents/inbox/TODAY--RUNSTAMP.txt
    ```
    ← *second pass: swap `TODAY` for `YESTERDAY`*
  - Method: **PUT**
  - Headers:
    - `Authorization` → `Bearer <your token>`
    - `Accept` → `application/vnd.github+json`
    - `X-GitHub-Api-Version` → `2022-11-28`
  - Request Body: **File** → the Text from E

Tap ▶︎ to run it by hand once. A green result and a new file under `inbox/` in
the repo means it works; open the app and the ticks should appear.

### 4. The nightly automation

Shortcuts → **Automation** → **+** → **Time of Day** → **23:50**, Daily → run
**Sweep habits** → turn **Ask Before Running off**. It won't run silently
otherwise.

Also add the shortcut to a Home Screen widget — handy for forcing a sync after
a late tick.

## How it behaves

- **Ticks after 23:50 aren't lost.** Every run re-reports yesterday too, so a
  reminder ticked at 23:55 lands in the next night's sweep.
- **Re-running is safe.** Applying a sweep is idempotent: files record how many
  ticks a day had, not "add one more". Running the shortcut five times in a row
  changes nothing.
- **In-app taps aren't double counted.** For daily and multi habits the reps
  already logged that day act as a floor.
- **Backfilled reps get the right date**, so streaks and the heatmap stay
  correct rather than piling everything onto sweep night.
- **Progress habits** count one tick as one `step` (e.g. 20 throws), not one rep.
- Sweep files older than 14 days are cleaned up automatically.

## Checking it works

The app syncs on launch and whenever it returns to the foreground. *Settings →
Sync* shows what happened, and **Sync now** forces a pull.

To test without waiting for the night, run the shortcut by hand, then open the
app — the ticks should appear within a second or two.

The merge logic has tests:

```bash
npm test
```

## If something looks wrong

| Symptom | Cause |
|---|---|
| "GitHub rejected the token" | Token expired, or missing Contents: Read and write on this repo |
| A reminder is listed as unmatched | Reminder title doesn't match any habit title |
| Nothing syncs at all | The automation has *Ask Before Running* on, or the list isn't named `Habits` |
| Upload fails at 23:50 | Base64 Encode has line breaks on, or the body was built with `Dictionary` instead of `Text` |
| Can't find a way to name a variable | You can't name an action's output from the action — add a `Set Variable` action after it (see the note in step 3) |
| A file called `TODAY--RUNSTAMP.txt` appears | The variable names were typed as text instead of inserted as variables |
| 422 from GitHub | Two runs produced the same filename — `RUNSTAMP` is missing or not `yyyyMMddHHmmss` |
