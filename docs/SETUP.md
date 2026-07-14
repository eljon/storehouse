# Setup Guide — Kalayaan Ward Bishop's Storehouse App

This app runs entirely on **Google Sheets + Google Apps Script**. There is
**no Cloud Console, no API key, and no billing** to set up. Everything below
takes about 10 minutes and only needs to be done once.

---

## What you'll end up with

- A **Google Sheet** that stores all your data (two tabs: `Inventory` and `Transactions`).
- A **mobile-friendly web app** (its own link) with three functions:
  - 📦 **Inventory** — check stock, search, see low / out-of-stock items
  - 📤 **Output** — record items taken out (recipient name + items chosen from stock)
  - 📥 **Input** — record items received (adds to stock, or creates a new item)

---

## Step 1 — Create the Google Sheet

1. Go to <https://sheets.google.com> and click **Blank spreadsheet**.
2. Rename it (top-left) to **`Kalayaan Storehouse`**.

## Step 2 — Open the script editor

1. In the sheet, click **Extensions → Apps Script**.
2. A new tab opens with a file called `Code.gs` containing an empty
   `function myFunction() {}`.

## Step 3 — Paste the code

You need to create **two files** in the Apps Script editor.

**File 1 — `Code.gs`**
1. Select everything in the existing `Code.gs` and delete it.
2. Open [`apps-script/Code.gs`](../apps-script/Code.gs) from this repo, copy the whole file, and paste it in.

**File 2 — `Index.html`**
1. Click the **`+`** next to *Files* → **HTML**.
2. Name it exactly **`Index`** (Apps Script adds the `.html` itself).
3. Delete the placeholder content, then copy the whole of
   [`apps-script/Index.html`](../apps-script/Index.html) and paste it in.

4. Click the **💾 Save** icon.

> *(Optional but recommended)* Set the project time zone to Manila:
> click **Project Settings (⚙️) → “Show appsscript.json manifest file”**,
> then open the `appsscript.json` file and replace its contents with
> [`apps-script/appsscript.json`](../apps-script/appsscript.json).

## Step 4 — Build the sheets & load starting inventory

1. Back on the editor, in the function dropdown at the top select **`setup`**.
2. Click **▶ Run**.
3. The first time, Google asks you to **authorize**:
   - Click **Review permissions** → pick your Google account.
   - You may see *“Google hasn't verified this app.”* This is normal for your
     own scripts. Click **Advanced → Go to (project name) (unsafe)** → **Allow**.
     *(It says “unsafe” only because it's an unpublished personal script — it's your own code.)*
4. Switch to the Sheet tab. You should now see an **`Inventory`** tab filled
   with the 40 emergency-prep items and a blank **`Transactions`** tab.

## Step 5 — Deploy the web app

1. In the editor, click **Deploy → New deployment**.
2. Click the **⚙️ gear → Web app**.
3. Fill in:
   - **Description:** `Storehouse app`
   - **Execute as:** **Me**
   - **Who has access:** choose one:
     - **Anyone** — anyone with the link can use it (simplest for shared workers).
     - **Anyone within [your org]** — if your ward uses a Google Workspace domain.
4. Click **Deploy**, authorize again if asked, and **copy the Web app URL**.
5. Open that URL on your phone or computer — that's your storehouse app.
   Bookmark it / add it to your home screen.

---

## Everyday use

- **Check inventory:** open the app → **Inventory** tab. Search or filter by
  category. Items below their target show a **LOW** badge; empty ones show **OUT**.
- **Record output:** **Output** tab → type the recipient, **+ Add item** for
  each item taken (chosen from current stock) with a quantity → **Record Output**.
  Stock is checked so you can't take out more than you have.
- **Record input:** **Input** tab → choose an existing item (or **➕ Add a NEW
  item**), enter the quantity received and the source → **Record Input**.

Every output and input is written to the **Transactions** tab with a
timestamp, so you always have a full paper trail.

---

## Updating the code later

If you change `Code.gs` or `Index.html`, save, then
**Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**.
The web app URL stays the same.

## Notes

- **`setup()` is safe to re-run** — it won't wipe an Inventory tab that already
  has data, and never touches your Transactions log.
- The starting quantities double as **target / par levels** for the low-stock
  badges. You can edit the `Target` column in the Inventory sheet anytime.
- To reset to an empty inventory, delete the rows under the header in the
  `Inventory` tab and run `setup()` again.
