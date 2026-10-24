# EventVerse AI V4

A portable, Antigravity-ready version of EventVerse AI V4: an event-planning command center for weddings, birthdays and community events.

## Features
- Event blueprint generator with budget breakdown and starter timeline
- BudgetGuard allocation visualization
- Run-of-show checklist with custom tasks
- Guest list and RSVP tracker
- Vendor quote tracker and status workflow
- Expense tracker, paid/planned totals and remaining-budget warning
- Chaos Mode recovery playbook for a vendor cancellation scenario
- Browser save/restore with `localStorage`
- Export full plan as JSON and guest/expense tables as CSV
- Responsive desktop/mobile layout

## Run locally
No build step or API key is required for this portable version.

**Option 1:** Open `public/index.html` in a browser.

**Option 2 (recommended):** From this folder run:
```bash
python -m http.server 8000
```
Then open `http://localhost:8000/public/`.

## Open in Google Antigravity
1. Extract `EventVerse_AI_V4.zip`.
2. Open Google Antigravity.
3. Choose **New Project** → **Add Folder**.
4. Select the extracted `EventVerse_AI_V4` folder and create the project.
5. Ask the agent to improve or extend the app.

Official guide: https://antigravity.google/docs/getting-started

## Important notes
- This is a portable frontend recreation of the V4 feature set, not a byte-for-byte export of the original Hatchable deployment.
- AI generation currently uses a deterministic local starter blueprint and Chaos Mode playbook; no API key or backend is needed to run it.
- All event data is stored locally in the browser on that device. Use the export buttons for backup; there is no shared database or cross-device sync.
- Vendor prices, availability, and bookings are not verified. Confirm all details directly with providers.
