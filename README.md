# Kalayaan Ward Bishop's Storehouse — Inventory App

A simple inventory-management web app for the Kalayaan Ward Bishop's Storehouse.
The UI is a **static site on GitHub Pages**; the data lives in a **Google Sheet**
served by a **Google Apps Script** API. **No Google Cloud Console, no API keys,
no billing** — anywhere.

## Features

| Function | What it does |
|----------|--------------|
| 📦 **Check inventory** | Browse current stock, search, filter by category, and spot **IN / LOW / OUT OF STOCK** and **expiry** status at a glance. |
| 📤 **Record output** | Log items leaving the storehouse — recipient name + one or more items picked with a **type-to-search** selector (shows live stock). Stock is validated so you can't over-issue. |
| 📥 **Record input** | Log items received — find an item with the **searchable** picker, or add a brand-new item on the fly. Optionally set/update an **expiry date**. |
| ⏰ **Expiry tracking** | Each item can carry an expiry date. Every card shows a human-readable countdown (*Expires in 1 yr 2 mo*, *Expired 6 days ago*). Items due within **3 months** (or already expired) are flagged and counted; tapping the Near-expiry tile lists **all dated items, soonest first**. |
| 🕘 **History** | Full log of every movement with **All / Output / Input** filters and a search box (by item, recipient, source, or worker), grouped by date. |

**Dashboard tiles** at the top show Items, **Near expiry (≤ 3 months)**, Low
stock, and Out of stock — the Near expiry / Low / Out tiles are **tap-to-filter**
(they jump to Inventory showing just those items; Near expiry is sorted soonest-first).

Every input and output is appended to a **Transactions** log (timestamp, type,
item, quantity, party, handled-by, running balance) for a full audit trail.

## How it fits together

```
   ┌─────────────────────────┐        fetch (JSON)        ┌──────────────────────────┐
   │  GitHub Pages (static)  │  ───────────────────────▶  │  Google Apps Script /exec │
   │  index.html + config.js │  ◀───────────────────────  │  (Web app, "Anyone")      │
   └─────────────────────────┘                            └────────────┬─────────────┘
        the app UI, on phones                                          reads / writes
                                                              ┌────────▼─────────┐
                                                              │   Google Sheet   │
                                                              │ Inventory + Log  │
                                                              └──────────────────┘
```

The browser calls the Apps Script Web app using CORS-simple requests
(`GET`, and `POST` with a `text/plain` body), so it works from a static host
with no server of our own and no Cloud Console.

## How the data is stored

The Google Sheet has two tabs, created automatically by `setup()`:

- **`Inventory`** — `ID · Category · Item · Notes/Size · Unit · Quantity · Target · Expiry`
- **`Transactions`** — `Timestamp · Type · Item ID · Item · Category · Quantity · Unit · Party · Handled By · Notes · Balance After`

The app is **seeded** from the ward's *Emergency Prep Shopping Checklist*
(2 meals × 60 pax + adult meds + kids meds + first aid + disposables — 40 items),
using the checklist quantities as both starting stock and reorder targets.

## Project structure

```
index.html            # The GitHub Pages app (UI). Talks to the Apps Script API.
config.js             # Put your Apps Script Web app URL here (optional; can also set it in-app).
.nojekyll             # Tells GitHub Pages to serve files as-is.
apps-script/
  Code.gs             # Backend: setup/seeding, JSON API (doGet/doPost), input/output writes.
  appsscript.json     # Manifest (Manila time zone, web-app config).
docs/
  SETUP.md            # Full step-by-step: deploy the API, publish Pages, connect them.
```

## Getting started

Follow **[docs/SETUP.md](docs/SETUP.md)**. In short:

1. **Backend:** create a Google Sheet → **Extensions → Apps Script** → paste
   `apps-script/Code.gs` → run `setup()` → **Deploy → Web app** (access:
   *Anyone*) → copy the URL.
2. **Frontend:** **Settings → Pages** → *Deploy from a branch* → root → open the
   Pages URL.
3. **Connect:** paste the Web app URL into the app once (or into `config.js` for
   everyone).

## Why this design?

- **GitHub Pages** is static-only, so the UI lives there and the data layer
  stays in Apps Script.
- A **container-bound Apps Script** reads/writes the Sheet with your own Google
  account and can be published as a web app **without a Cloud Console project or
  API credentials** — matching the "no Cloud Console" requirement.
