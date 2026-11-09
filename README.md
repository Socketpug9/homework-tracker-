# Homework

A homework tracker for iPhone that you add to your Home Screen. No App Store.

- Add homework for a class, with a due date/time and importance (low / medium / high)
- See what's overdue, due today, tomorrow, this week and later, with a countdown on each
- Filter by class, tap the circle to finish (with undo), tap an item to edit
- Reminders when you get home and 30 minutes later, using the iPhone Shortcuts app (guide inside the app: Settings → Home reminders)
- Optional Home Screen icon badge with the number of things due in the next 24 hours
- Works offline. Data is saved on your phone only; use Settings → Backup to export it

## Put it on your iPhone

1. GitHub → this repo → **Settings → General → Danger Zone → Change visibility → Public**.
2. **Settings → Pages → Build and deployment**: Source **Deploy from a branch**,
   Branch **`claude/wizardly-cannon-4m0rob`** (or `main` once merged), folder **`/ (root)`** → **Save**.
3. Wait about a minute. The site is at **https://socketpug9.github.io/homework-tracker-/**
4. Open that link in **Safari** on the iPhone. The app shows the Add to Home Screen steps:
   **Share → Add to Home Screen → Add**.
5. Open **Homework** from the Home Screen, then Settings → **Set up home reminders**.

Every push to the chosen branch updates the site by itself.

## Files

`index.html`, `styles.css`, `app.js` (the app), `sw.js` (offline cache), `manifest.webmanifest` + `icons/` (Home Screen install).
When you change a file, bump `VERSION` in `sw.js` so phones pick up the update.
