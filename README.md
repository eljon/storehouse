# Kalayaan Ward Bishop's Storehouse — Inventory App

A simple inventory-management web app for the Kalayaan Ward Bishop's Storehouse.
It runs on **Google Sheets + Google Apps Script** — **no Google Cloud Console,
no API keys, no billing**. Your data lives in one Google Sheet you own.

## Features

| Function | What it does |
|----------|--------------|
| 📦 **Check inventory** | Browse current stock, search, filter by category, and spot **LOW** / **OUT OF STOCK** items at a glance. |
| 📤 **Record output** | Log items leaving the storehouse — recipient name + one or more items chosen from what's in stock. Stock is validated so you can't over-issue. |
| 📥 **Record input** | Log items received — add to an existing item's stock, or create a brand-new item on the fly. |

Every input and output is appended to a **Transactions** log (timestamp, type,
item, quantity, party, handled-by, notes, running balance) for a full audit trail.

## How the data is stored

The Google Sheet has two tabs, created automatically:

- **`Inventory`** — `ID · Category · Item · Notes/Size · Unit · Quantity · Target`
- **`Transactions`** — `Timestamp · Type · Item ID · Item · Category · Quantity · Unit · Party · Handled By · Notes · Balance After`

The app is **seeded** from the ward's *Emergency Prep Shopping Checklist*
(2 meals × 60 pax + adult meds + kids meds + first aid + disposables — 40 items),
using the checklist quantities as both starting stock and reorder targets.

## Project structure

```
apps-script/
  Code.gs           # Server-side: setup/seeding, reads, and input/output writes
  Index.html        # The mobile-friendly web app UI (single file)
  appsscript.json   # Manifest (Manila time zone, web-app config)
docs/
  SETUP.md          # Step-by-step: create the Sheet → paste code → deploy
```

## Getting started

Follow **[docs/SETUP.md](docs/SETUP.md)**. In short:

1. Create a blank Google Sheet → **Extensions → Apps Script**.
2. Paste in `apps-script/Code.gs` and add an HTML file `Index` with `apps-script/Index.html`.
3. Run `setup()` once (authorize when prompted) to build + seed the sheets.
4. **Deploy → New deployment → Web app**, and open the link on your phone.

## Why Apps Script (and not the Cloud Console)?

A **container-bound** Apps Script is attached directly to your Sheet. It reads
and writes that Sheet using your own Google account's permission, and Google
lets you publish it as a web app without creating a Cloud project or API
credentials — exactly matching the "no Cloud Console" requirement.
