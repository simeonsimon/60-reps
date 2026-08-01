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

One shortcut named **Sweep habits**: some date setup, then a sweep block for
today, and optionally the same block again for yesterday.

**Set up the dates first.** Each is a pair of actions: format the date, then
store it under a name you can reuse.

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
| 3 | `Format Date` | Date: **Current Date** · Custom → `yyyyMMddHHmmss` |
| 4 | `Set Variable` | Name: `RUNSTAMP` |

Both `Format Date` actions take **Current Date**. Feeding the second one `TODAY`
is the obvious-looking shortcut and it's wrong: `TODAY` is already a formatted
string pinned to midnight, so every run of the day would produce an identical
`RUNSTAMP`.

Only add these three if you're building the optional YESTERDAY block:

| # | Action | Settings |
|---|---|---|
| 5 | `Adjust Date` | **Current Date** · **Subtract** · **1** · **Day** — not `TODAY`, which is a string |
| 6 | `Format Date` | Date: the **Adjusted Date** · Custom → `yyyy-MM-dd` |
| 7 | `Set Variable` | Name: `YESTERDAY` |

To set **Custom** format: tap the `Format Date` action, set *Date Format* to
**Custom**, then type the pattern into the *Format String* field that appears.

`RUNSTAMP` is what keeps each night's file unique. Without it, tonight's sweep
of yesterday would collide with last night's sweep of the same day and the
upload would fail.

Everywhere below that names a variable in caps, insert it from the variable
row above the keyboard (or the **Select Variable** button) — don't type the
word literally, or you'll upload a file called `TODAY--RUNSTAMP.txt`.

**The sweep block goes in the same shortcut**, directly below the date setup:

```
date setup    4 actions  (7 if you build YESTERDAY)
sweep block   8 actions  — S1 to S8 below
optional      the same 8 actions again, for yesterday
```

**S1. `Find Reminders`** — tap **Filter** and add three:

- `List` **is** `Habits`
- `Is Completed` **is** `Yes`
- a date filter **is today** — see which one your version offers:

| Filter | Meaning | Use it? |
|---|---|---|
| `Completion Date` | when you ticked it | **prefer this** |
| `Due Date` / `Deadline` / `Date` | when it was scheduled | fine, use if the above is missing |

`Due Date`, `Deadline` and `Date` are one and the same — a reminder has a single
scheduled date, and iOS versions and localizations just label it differently.
Take whichever of those three your filter list shows.

`Completion Date` is a genuinely different field, and the better one: tick a
Monday reminder on Tuesday and a scheduled-date filter files that rep under
Monday, the wrong day for your streak, while completion date files it under
Tuesday, when you actually did it. Use it if it's offered. Everything
downstream works the same either way.

**S2. `Count`** — counting `Reminders`, the output of S1.

**S3. `If`** — `Count` **is greater than** `0`. Actions S4–S7 must sit *inside*
the If, above `End If`; drag them in if they land outside. This is what stops a
day with nothing ticked from erroring the automation out.

**S4. `Combine Text`** — input the **Reminders** from S1, then **tap the variable
pill and choose `Name`**. Without that you combine reminder objects rather than
their titles. Separator: **New Lines**. Ticking something twice gives two lines,
which is what the app counts.

**S5. `Base64 Encode`** the Combined Text. Tap the **⌄** to expand the action and
set **Line Breaks: None** — wrapped Base64 is rejected by the API.

**S6. `Text`** — the request body. Build it as `Text`, never `Dictionary` (the
dictionary action chokes on larger payloads). Type it in this order, so the
variable lands *inside* the JSON rather than in front of it:

1. type `{"message": "sweep", "content": "`
2. insert the **Base64 Encoded** variable
3. type `", "branch": "main"}`

The finished action holds exactly one pill, sitting between two quote marks:
```
{"message": "sweep", "content": «Base64 Encoded», "branch": "main"}
```
Turn **Smart Punctuation off** (Settings → General → Keyboard) first, or iOS
curls the quotes and the JSON is invalid.

**S7. `Get Contents of URL`**
- URL — type the text but **insert `TODAY` and `RUNSTAMP` from the variable
  picker**, don't type their names:
  ```
  https://api.github.com/repos/simeonsimon/60-reps/contents/inbox/TODAY--RUNSTAMP.txt
  ```
- Method: **PUT**
- Headers: `Authorization` → `Bearer <token>` · `Accept` →
  `application/vnd.github+json` · `X-GitHub-Api-Version` → `2022-11-28`
- Request Body: **File** → the Text from S6

**S8. `End If`.**

Tap ▶︎ now. Success is a JSON response mentioning `"content"` plus a new file
under `inbox/` in the repo. Open the app and the ticks should appear.

#### Mistakes this build actually produced

Every one of these was hit on the first real attempt, and none of them announce
themselves:

- **The shortcut outputs `0` and nothing uploads.** `Count` was zero, so the
  `If` skipped everything. The filter matched no reminders — check the list is
  named exactly `Habits` and that you have actually ticked something today.
  The app reporting "up to date" is correct in this case, not a failure.
- **The Base64 pill lands at the front of the Text action** rather than inside
  the JSON, leaving the literal word `BASE64` in the body. The result is not
  valid JSON and GitHub answers 400. There must be exactly one pill, sitting
  between the two quote marks after `"content":`.
- **Smart punctuation rewrites `"` as `"`**, which also kills the JSON. Turn it
  off in Settings → General → Keyboard.
- **`TODAY` and `RUNSTAMP` typed into the URL as words.** They must be inserted
  as variables; otherwise you upload a file called `TODAY--RUNSTAMP.txt`.
- **`RUNSTAMP` formatted from `TODAY` or `YESTERDAY`** instead of Current Date.
  Those are already-formatted *strings* fixed to midnight, so every run of the
  day produces the same stamp, and the second run collides with a 422. Format
  it from **Current Date**.
- **A hardcoded date in the filter.** `Completion Date is on 01/08/2026` works
  the day you build it and silently sweeps the wrong day forever after. It needs
  to reference Current Date.

#### The YESTERDAY block is optional

The optional second block repeats S1–S8 with the date filter set to yesterday and `YESTERDAY` in
the URL. It exists only to catch ticks made between 23:50 and midnight, or a
night the automation didn't fire.

Check what your version's date filter actually offers. If there is a
**Yesterday** option, build it. If there isn't, **skip it** — the cost is a
ten-minute window per day, and the Home Screen widget lets you force a sweep
whenever you want.

> **If you duplicate S1–S8 instead of rebuilding, re-check every variable in the
> copy.** Duplicated actions in Shortcuts frequently keep pointing at the
> *original* actions' outputs, so the second block would silently upload the
> first block's reminders under yesterday's filename. Rebuilding from scratch is
> less error-prone than hunting for that.

### 4. The nightly automation

Shortcuts → **Automation** → **+** → **Time of Day** → **23:50**, Daily → run
**Sweep habits** → turn **Ask Before Running off**. It won't run silently
otherwise.

Also add the shortcut to a Home Screen widget — handy for forcing a sync after
a late tick.

## How it behaves

- **Ticks after 23:50** are only caught if you built the optional YESTERDAY
  block — it re-reports the previous day, so a reminder ticked at 23:55 lands in
  the next night's sweep. Without it, tick it in the app or run the shortcut
  from the widget.
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
