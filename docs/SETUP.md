# Setup Guide — Kalayaan Ward Bishop's Storehouse App

The app has two halves that work together — **no Google Cloud Console, no API
key, and no billing** anywhere:

1. **Backend (your data)** — a **Google Apps Script** attached to a Google
   Sheet, deployed as a small JSON **Web app**. This holds and serves the data.
2. **Frontend (the app UI)** — static files (`index.html`) hosted free on
   **GitHub Pages**. It talks to the Web app from step 1.

Do **Part A** first (you'll get a URL), then **Part B**, then paste the URL in.

---

## Part A — Backend: Google Sheet + Apps Script API

### A1. Create the Google Sheet
1. Go to <https://sheets.google.com> → **Blank spreadsheet**.
2. Rename it (top-left) to **`Kalayaan Storehouse`**.

### A2. Add the script
1. In the sheet: **Extensions → Apps Script**.
2. Delete everything in the `Code.gs` file, then paste in the full contents of
   [`apps-script/Code.gs`](../apps-script/Code.gs) from this repo.
3. Click **💾 Save**.

> *(Optional)* To set the Manila time zone, open **Project Settings (⚙️) →
> "Show appsscript.json manifest file"**, then replace that file's contents
> with [`apps-script/appsscript.json`](../apps-script/appsscript.json).

### A3. Build the sheets & load starting inventory

**Easiest way — the Storehouse menu:**
1. Go back to the **Sheet** tab and **reload the page** (F5).
2. A new **🏬 Storehouse** menu appears next to *Help*. Click it →
   **① Set up / load starting data**.
3. Authorize when asked:
   - **Review permissions** → pick your Google account.
   - If you see *"Google hasn't verified this app"* (normal for your own
     script): **Advanced → Go to (project) (unsafe) → Allow**.
   - Click the menu item **again** after authorizing (the first click only
     grants permission).
4. You'll get a "Done! Loaded 40 starting items" dialog, and the **`Inventory`**
   tab will be filled, with an empty **`Transactions`** tab.

> **From the editor instead?** Make sure the function dropdown (next to ▶ Run)
> says **`setup`** — NOT `doGet`. Running `doGet` reports "Execution completed"
> but writes nothing. Only `setup` loads the data.

### A4. Deploy as a Web app (this is your API)
1. In the editor: **Deploy → New deployment**.
2. Click the **⚙️ gear → Web app**.
3. Set:
   - **Execute as:** **Me**
   - **Who has access:** **Anyone**  ← required so the GitHub Pages site can reach it
4. **Deploy**, authorize if asked, then **copy the Web app URL**
   (it looks like `https://script.google.com/macros/s/AKfy…/exec`).
   **Keep this URL** — you'll paste it into the app in Part B.

---

## Part B — Frontend: publish on GitHub Pages

### B1. Enable GitHub Pages
1. In this GitHub repository: **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Pick the branch that has these files and folder **`/ (root)`** → **Save**.
4. Wait ~1 minute. GitHub shows the live URL, e.g.
   `https://<your-username>.github.io/storehouse/`. Open it.

### B2. Connect the app to your Sheet
When the site first opens it asks for the **Apps Script Web app URL**:

- **Option 1 (per device):** paste the URL from step **A4** into the box and
  click **Connect**. It's remembered in that browser. Repeat once on each
  phone/computer that uses the app.
- **Option 2 (everyone at once):** edit [`config.js`](../config.js), put your
  URL between the quotes:
  ```js
  window.STOREHOUSE_API_URL = "https://script.google.com/macros/s/AKfy…/exec";
  ```
  commit it, and every visitor is connected automatically — no pasting needed.

That's it — bookmark the Pages URL / add it to your home screen.

---

## Everyday use

- **📦 Inventory** — a card grid; search or filter by category. Items below their
  target show a **LOW** badge; empty ones show **OUT**. **Tap any card** to open
  its detail: the item's full **history** plus quick **Distribute / Restock /
  Edit / Delete** actions. *Edit* corrects the item's **name, category,
  notes/size, unit, target, and expiry** (quantity is changed only through
  Restock / Distribute, to keep the audit trail correct). *Delete* (Bishop's
  password required) removes the item and is recorded as a **distribution** of
  whatever stock was left.
- **📤 Distribute** — enter the recipient, then **type to search** for each item
  taken (the picker shows current stock) or **📷 Scan barcode** to add it, set a
  quantity, **+ Add item** for more → **Distribute**. You can't issue more than
  is in stock.
- **📥 Restock** — type to search for an item, **📷 Scan barcode**, or pick
  **➕ Add a NEW item**, enter the quantity received and the source, and
  optionally an **expiry date** and **barcode** → **Restock**. (Leaving expiry
  blank keeps the item's current date.)
- **📷 Barcode scanning** — the **Scan barcode** buttons on Distribute and
  Restock open the phone camera and read the item's barcode. It works on both
  **Android** (Chrome/Edge, via the browser's built-in reader) and **iPhone**
  (Safari/Chrome, via a small scanning engine loaded on demand the first time you
  scan — so the very first scan needs a moment of internet). If the camera can't
  be opened or the engine can't load, type or scan the code into the box instead
  — a USB/Bluetooth barcode scanner works there as a keyboard. A known barcode
  jumps to that item; an unknown one starts a new item with the code saved. Set
  or change an item's barcode from its **Edit** tab or when adding it in Restock.
  (The camera only works over **https** — the GitHub Pages URL already is.)
- **⏰ Expiry** — every item with a date shows a human-readable countdown
  (e.g. *Expires in 1 yr 2 mo*, *Expires in 28 days*, or *Expired 6 days ago*).
  The top **Near expiry** tile counts items due within 3 months (or already
  expired); tap it to see **all items that have an expiry date, soonest first**.
  The **Low stock** and **Out of stock** tiles are tap-to-filter too.
- **🧾 Receipts** — when distributing, choose **Save & print** or **Save only**.
  The receipt lists all items and has a clearly-marked **signature box** the
  recipient signs with a mouse or finger. **Save & Print** stores the
  signature and prints; the receipt also shows **Bishop Eljon Serrano's**
  signature when verified. In **History**, a signed Distribute row shows
  **View receipt** — reopen it to see the saved signatures or reprint.
- **✅ Bishop's verification** — sign off a transaction with the Bishop's
  password. Do it **while recording** (the **Bishop's verification** button on
  the Distribute / Restock forms) or **later from History** (the **Verify** button on
  any unverified row). Each verification is stamped with the date and time.
- **🕘 History** — every movement in one place. Filter by **All / Restock /
  Distribute**, by **Verified / Unverified**, or use the search box (item,
  recipient, source, worker). Verified rows show when they were verified. Each
  row has a **Delete** button (Bishop's password required) that removes the
  transaction and **reverses its effect on stock** — deleting a distribution
  returns the items, deleting a restock removes them.

Every input/output is written to the **Transactions** tab with a timestamp, so
you always have a full paper trail.

---

## Updating the code later

- **Frontend** (`index.html`): just push to the branch — GitHub Pages redeploys automatically.
- **Backend** (`Code.gs`): paste the changes into the Apps Script editor, save,
  then **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**.
  The Web app URL stays the same, so nothing else needs updating.

## Troubleshooting

- **"Could not connect" / "Failed to fetch":** the Web app URL is wrong or the
  deployment's access isn't **Anyone**. Re-check step A4, then use the app's
  **⚙️ settings** to re-enter the URL. Make sure it ends in `/exec` (not `/dev`).
- **Changed the code but nothing changed:** you must create a **New version**
  under *Manage deployments* (step above) for backend changes to go live.

## Notes

- **Updated to a newer version (Expiry / Verification / Barcode)?** Re-paste the
  latest `apps-script/Code.gs`, save, then run **🏬 Storehouse → ① Set up / load
  starting data** once. It adds the **Expiry** and **Barcode** columns to the
  Inventory sheet and the **Verified / Verified At / Signature / Signed At**
  columns to the Transactions sheet without touching your data. Then publish a
  **new version** of the Web app (*Deploy → Manage deployments → ✏️ → New version
  → Deploy*).
- **Changing the Bishop's password?** Edit the `BISHOP_PASSWORD` value near the
  top of `apps-script/Code.gs`, save, and publish a **new version**. The
  password lives only in the Apps Script (not in the public GitHub Pages site).
- **`setup()` is safe to re-run** — it won't wipe an Inventory tab that already
  has data, and never touches your Transactions log.
- Starting quantities double as **target / par levels** for the low-stock
  badges. Edit the `Target` column in the Inventory sheet anytime.
- **Who can write:** because access is *Anyone with the link*, treat the Pages
  URL as semi-private (share only with storehouse workers). Ask if you'd like a
  simple PIN gate added.
