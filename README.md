# Homework

A homework tracker for iPhone that you add to your Home Screen. No App Store.

- Add homework for a class, with a due date/time and importance (low / medium / high)
- See what's overdue, due today, tomorrow, this week and later, with a countdown on each
- Filter by class, tap the circle to finish (with undo), tap an item to edit
- Reminders when you get home and 30 minutes later, using the iPhone Shortcuts app (guide inside the app: Settings → Home reminders)
- Optional Home Screen icon badge with the number of things due in the next 24 hours
- Works offline. Data is saved on your phone only; use Settings → Backup to export it

## Put it on your iPhone

1. The site has to be online. This repo deploys itself to GitHub Pages from `main`
   (repo **Settings → Pages → Source: GitHub Actions**). GitHub Pages on a private repo
   needs a paid plan, so either make the repo public or drag the folder onto
   https://app.netlify.com/drop.
2. On the iPhone, open the site in **Safari** → tap **Share** → **Add to Home Screen** → **Add**.
3. Open **Homework** from the Home Screen (not Safari, they keep separate data).
4. In the app: Settings → **Set up home reminders** and follow the 4 steps.

## Files

`index.html`, `styles.css`, `app.js` (the app), `sw.js` (offline cache), `manifest.webmanifest` + `icons/` (Home Screen install).
When you change a file, bump `VERSION` in `sw.js` so phones pick up the update.
