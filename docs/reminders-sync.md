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

**Set up the two dates first:**

| Action | Settings |
|---|---|
| `Format Date` | Date: **Current Date**, Format: Custom → `yyyy-MM-dd` → rename variable **TODAY** |
| `Adjust Date` | **Current Date**, Subtract **1 Day** |
| `Format Date` | Date: the adjusted date, Custom → `yyyy-MM-dd` → rename **YESTERDAY** |
| `Format Date` | Date: **Current Date**, Custom → `yyyyMMddHHmmss` → rename **RUNSTAMP** |

`RUNSTAMP` is what keeps each night's file unique. Without it, tonight's sweep
of yesterday would collide with last night's sweep of the same day and the
upload would fail.

**Then, for each of TODAY and YESTERDAY:**

1. **`Find Reminders`** — Filter: `List` is `Habits`, `Is Completed` is `Yes`,
   `Due Date` is **Today** (or **Yesterday** for the second pass).
2. **`Count`** the result → **`If` `Count` is greater than `0`** — skip the
   upload on a day where you ticked nothing, so the automation can't error out.
3. **`Combine Text`** on the found reminders, Separator: **New Lines**. A
   reminder coerces to its title, so this gives you one title per line, repeated
   if you ticked it more than once.
4. **`Base64 Encode`** that text. Expand the action and set
   **Line Breaks: None** — wrapped Base64 is rejected by the API.
5. **`Text`** action holding the request body. Build it as *Text*, not as a
   `Dictionary` — the dictionary action chokes on larger payloads:
   ```
   {"message":"sweep","content":"BASE64","branch":"main"}
   ```
   with `BASE64` replaced by the variable from step 4.
6. **`Get Contents of URL`**
   - URL: `https://api.github.com/repos/simeonsimon/60-reps/contents/inbox/TODAY--RUNSTAMP.txt`
     (variables inline; use `YESTERDAY` on the second pass)
   - Method: **PUT**
   - Headers:
     - `Authorization` → `Bearer <your token>`
     - `Accept` → `application/vnd.github+json`
     - `X-GitHub-Api-Version` → `2022-11-28`
   - Request Body: **File** → the Text from step 5

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
