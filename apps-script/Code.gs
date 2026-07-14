/**
 * Kalayaan Ward Bishop's Storehouse — Inventory Management
 * -------------------------------------------------------
 * A container-bound Google Apps Script web app. All data lives in the
 * Google Sheet this script is attached to. No Cloud Console / API keys needed.
 *
 * Sheets used (created automatically by setup()):
 *   - "Inventory"     : current stock of every item
 *   - "Transactions"  : an append-only log of every input (IN) and output (OUT)
 *
 * First-time setup:
 *   1. Run setup() once from the editor to build the sheets + seed the
 *      emergency-prep checklist as starting inventory.
 *   2. Deploy > New deployment > Web app to get the shareable app link.
 */

/* ============================ Configuration ============================ */

const INVENTORY_SHEET = 'Inventory';
const TX_SHEET        = 'Transactions';

const INV_HEADERS = ['ID', 'Category', 'Item', 'Notes / Size', 'Unit', 'Quantity', 'Target'];
const TX_HEADERS  = ['Timestamp', 'Type', 'Item ID', 'Item', 'Category',
                     'Quantity', 'Unit', 'Party', 'Handled By', 'Notes', 'Balance After'];

const APP_TITLE = "Kalayaan Ward Bishop's Storehouse";

/**
 * Starting inventory, taken from the emergency-prep checklist
 * (2 meals x 60 pax + meds + first aid). The checklist quantities are used
 * as both the starting stock AND the target/par level for low-stock alerts.
 * Columns: [Category, Item, Notes / Size, Unit, Quantity]
 */
const SEED_DATA = [
  ['Food Ready to Prepare', '555 Tuna', '155g can, ~1 can per 2 pax', 'can', 15],
  ['Food Ready to Prepare', 'Fresca Tuna', '155g can', 'can', 15],
  ['Food Ready to Prepare', 'Argentina Meat Loaf', '150g can', 'can', 15],
  ['Food Ready to Prepare', 'Nissin Cup Noodles', '40g cup, 1 per pax per meal', 'cup', 60],
  ['Food Ready to Prepare', 'Knorr Arroz Caldo', 'cup / sachet', 'pc', 30],
  ['Food Ready to Prepare', "Champorado (Alfonso's or any brand)", 'sachet', 'sachet', 30],
  ['Food Ready to Prepare', 'Energen', 'sachet, 1 per pax', 'sachet', 60],
  ['Food Ready to Prepare', 'Skyflakes', 'pack of 10 singles', 'pack', 6],
  ['Food Ready to Prepare', 'Assorted biscuits', 'family packs', 'pack', 4],
  ['Food Ready to Prepare', 'Summit Mineral Water (gallon)', 'gallon container, for adults', 'gallon', 6],
  ['Food Ready to Prepare', 'Distilled Water (gallon, for baby)', 'gallon container', 'gallon', 6],

  ['Adults Med', 'Paracetamol 500mg (generic)', 'box of 100 tabs', 'box', 1],
  ['Adults Med', 'Biogesic 500mg', 'strip of 10 tabs', 'strip', 3],
  ['Adults Med', 'Bioflu', 'strip of 10 tabs', 'strip', 2],
  ['Adults Med', 'Diatabs', 'strip of 10 caps', 'strip', 2],
  ['Adults Med', 'Buscopan 10mg', 'strip of 10 tabs', 'strip', 1],
  ['Adults Med', 'Strepsils', 'pack of 24', 'pack', 1],

  ['Kids Med', 'Paracetamol syrup (0-6 yrs)', '60ml bottle', 'bottle', 2],
  ['Kids Med', 'Biogesic for Kids', '60ml bottle', 'bottle', 2],
  ['Kids Med', 'Neozep for Kids / decongestant', '60ml bottle', 'bottle', 2],
  ['Kids Med', 'Cetirizine syrup', '60ml bottle', 'bottle', 2],
  ['Kids Med', 'Lagundi syrup (Ascof / Plemex)', '120ml bottle', 'bottle', 2],

  ['First Aid Kit', 'Betadine', '120ml', 'bottle', 1],
  ['First Aid Kit', 'Surgical tape', 'roll', 'roll', 2],
  ['First Aid Kit', 'Ice bag', 'standard', 'pc', 1],
  ['First Aid Kit', 'Gauze pads (2x2, 3x3, 4x4)', 'assorted packs', 'pack', 3],
  ['First Aid Kit', 'Efficascent Oil', '50ml', 'bottle', 2],
  ['First Aid Kit', 'Manzanilla', '25ml', 'bottle', 1],
  ['First Aid Kit', 'Cotton balls', 'big pack', 'pack', 2],
  ['First Aid Kit', 'Band-Aid (adults, kids)', 'box of 50-100', 'box', 2],
  ['First Aid Kit', 'Hydrogen peroxide', '120ml', 'bottle', 1],
  ['First Aid Kit', 'Isopropyl alcohol 70%', '500ml', 'bottle', 2],
  ['First Aid Kit', 'Surgical gloves', 'box of 50-100 pcs', 'box', 1],
  ['First Aid Kit', 'Facemask', 'box of 50', 'box', 1],

  ['Disposables', 'Paper plates', 'pack of 25, 120 pcs needed', 'pack', 5],
  ['Disposables', 'Plastic spoons', 'pack of 25', 'pack', 5],
  ['Disposables', 'Plastic forks', 'pack of 25', 'pack', 5],
  ['Disposables', 'Paper/plastic cups', 'pack of 25', 'pack', 5],
  ['Disposables', 'Table napkins / tissue', 'big pack', 'pack', 2],
  ['Disposables', 'Garbage bags', 'roll of 10, large', 'roll', 2]
];

/* ============================ Web app entry ============================ */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle(APP_TITLE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setFaviconUrl('https://ssl.gstatic.com/docs/spreadsheets/favicon3.ico');
}

/** Small values the client needs to render itself. */
function getAppInfo() {
  return { title: APP_TITLE };
}

/* ============================ Setup / seeding ========================== */

/**
 * Run ONCE from the Apps Script editor to build the sheets and load the
 * starting inventory. Safe to re-run: it will only (re)seed the Inventory
 * sheet if it is empty, and never touches existing Transactions.
 */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const inv = getOrCreateSheet_(ss, INVENTORY_SHEET);
  const tx  = getOrCreateSheet_(ss, TX_SHEET);

  ensureHeaders_(inv, INV_HEADERS);
  ensureHeaders_(tx,  TX_HEADERS);

  // Seed inventory only when there is no data yet (headers only).
  if (inv.getLastRow() <= 1) {
    const rows = SEED_DATA.map(function (r, i) {
      const id = i + 1;                       // ID
      return [id, r[0], r[1], r[2], r[3], r[4], r[4]]; // Quantity & Target = checklist qty
    });
    inv.getRange(2, 1, rows.length, INV_HEADERS.length).setValues(rows);
  }

  formatInventorySheet_(inv);
  formatTransactionsSheet_(tx);

  SpreadsheetApp.getActiveSpreadsheet().toast('Setup complete. Deploy as a Web app to use the storehouse app.', APP_TITLE, 8);
}

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function ensureHeaders_(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

function formatInventorySheet_(sheet) {
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, INV_HEADERS.length)
    .setFontWeight('bold').setBackground('#1a4731').setFontColor('#ffffff');
  autoResize_(sheet, INV_HEADERS.length);
}

function formatTransactionsSheet_(sheet) {
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, TX_HEADERS.length)
    .setFontWeight('bold').setBackground('#1a4731').setFontColor('#ffffff');
  autoResize_(sheet, TX_HEADERS.length);
}

function autoResize_(sheet, cols) {
  for (var c = 1; c <= cols; c++) sheet.autoResizeColumn(c);
}

/* ============================ Reads ==================================== */

/** Returns every inventory item as a plain object, sorted by category then item. */
function getInventory() {
  const sheet = mustSheet_(INVENTORY_SHEET);
  const last = sheet.getLastRow();
  if (last <= 1) return [];

  const values = sheet.getRange(2, 1, last - 1, INV_HEADERS.length).getValues();
  const items = values
    .filter(function (r) { return r[0] !== '' && r[0] !== null; })
    .map(function (r) {
      return {
        id: r[0],
        category: r[1],
        item: r[2],
        notes: r[3],
        unit: r[4],
        quantity: Number(r[5]) || 0,
        target: Number(r[6]) || 0
      };
    });

  items.sort(function (a, b) {
    if (a.category === b.category) return String(a.item).localeCompare(String(b.item));
    return String(a.category).localeCompare(String(b.category));
  });
  return items;
}

/** Convenience payload the web UI loads on start / after each change. */
function getDashboard() {
  const items = getInventory();
  const categories = [];
  items.forEach(function (it) {
    if (categories.indexOf(it.category) === -1) categories.push(it.category);
  });
  var lowStock = 0, outOfStock = 0, totalUnits = 0;
  items.forEach(function (it) {
    totalUnits += it.quantity;
    if (it.quantity <= 0) outOfStock++;
    else if (it.target > 0 && it.quantity < it.target) lowStock++;
  });
  return {
    items: items,
    categories: categories,
    stats: {
      distinctItems: items.length,
      totalUnits: totalUnits,
      lowStock: lowStock,
      outOfStock: outOfStock
    }
  };
}

/** Most recent transactions, newest first (capped). */
function getRecentTransactions(limit) {
  limit = limit || 25;
  const sheet = mustSheet_(TX_SHEET);
  const last = sheet.getLastRow();
  if (last <= 1) return [];
  const n = Math.min(limit, last - 1);
  const values = sheet.getRange(last - n + 1, 1, n, TX_HEADERS.length).getValues();
  const out = values.map(function (r) {
    return {
      timestamp: r[0] ? formatTs_(r[0]) : '',
      type: r[1],
      item: r[3],
      category: r[4],
      quantity: r[5],
      unit: r[6],
      party: r[7],
      handledBy: r[8],
      notes: r[9],
      balanceAfter: r[10]
    };
  });
  return out.reverse(); // newest first
}

/* ============================ Writes ================================== */

/**
 * Record an OUTPUT (items leaving the storehouse).
 * payload = {
 *   recipient: String,           // who is receiving the items
 *   handledBy: String,           // storehouse worker recording this
 *   notes: String,               // optional
 *   lines: [{ id: Number, quantity: Number }]  // items chosen from inventory
 * }
 * Returns { ok, message, dashboard } or throws on validation failure.
 */
function recordOutput(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    payload = payload || {};
    const recipient = String(payload.recipient || '').trim();
    const handledBy = String(payload.handledBy || '').trim();
    const notes     = String(payload.notes || '').trim();
    const lines     = (payload.lines || []).filter(function (l) {
      return l && Number(l.quantity) > 0;
    });

    if (!recipient) throw new Error('Please enter the recipient name.');
    if (lines.length === 0) throw new Error('Please add at least one item with a quantity.');

    const sheet = mustSheet_(INVENTORY_SHEET);
    const last = sheet.getLastRow();
    const range = sheet.getRange(2, 1, last - 1, INV_HEADERS.length);
    const values = range.getValues();

    // Map id -> row index in `values`
    const indexById = {};
    values.forEach(function (r, i) { if (r[0] !== '') indexById[String(r[0])] = i; });

    // Validate stock first (all-or-nothing).
    lines.forEach(function (l) {
      const i = indexById[String(l.id)];
      if (i === undefined) throw new Error('Item not found (ID ' + l.id + '). Try refreshing.');
      const have = Number(values[i][5]) || 0;
      const want = Number(l.quantity);
      if (want > have) {
        throw new Error('Not enough "' + values[i][2] + '" in stock. Available: ' +
                        have + ' ' + values[i][4] + ', requested: ' + want + '.');
      }
    });

    // Apply decrements + build transaction rows.
    const ts = new Date();
    const txRows = [];
    lines.forEach(function (l) {
      const i = indexById[String(l.id)];
      const want = Number(l.quantity);
      const balanceAfter = (Number(values[i][5]) || 0) - want;
      values[i][5] = balanceAfter;
      txRows.push([ts, 'OUT', values[i][0], values[i][2], values[i][1],
                   want, values[i][4], recipient, handledBy, notes, balanceAfter]);
    });

    range.setValues(values);
    appendTransactions_(txRows);

    return {
      ok: true,
      message: 'Recorded output of ' + lines.length + ' item(s) to ' + recipient + '.',
      dashboard: getDashboard()
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Record an INPUT (items coming into the storehouse).
 * payload = {
 *   id: Number|null,     // existing item id, OR null to create a new item
 *   quantity: Number,
 *   source: String,      // where it came from (donor / purchase)
 *   handledBy: String,
 *   notes: String,
 *   // only when id is null (new item):
 *   category, item, unit, itemNotes, target
 * }
 * Returns { ok, message, dashboard } or throws.
 */
function recordInput(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    payload = payload || {};
    const qty       = Number(payload.quantity);
    const source    = String(payload.source || '').trim();
    const handledBy = String(payload.handledBy || '').trim();
    const notes     = String(payload.notes || '').trim();

    if (!(qty > 0)) throw new Error('Please enter a quantity greater than zero.');

    const sheet = mustSheet_(INVENTORY_SHEET);
    const last = sheet.getLastRow();
    const values = last > 1 ? sheet.getRange(2, 1, last - 1, INV_HEADERS.length).getValues() : [];

    var rowObj, itemName, category, unit, balanceAfter, itemId;

    if (payload.id !== null && payload.id !== undefined && payload.id !== '') {
      // Existing item: find + increment.
      var i = -1;
      for (var k = 0; k < values.length; k++) {
        if (String(values[k][0]) === String(payload.id)) { i = k; break; }
      }
      if (i === -1) throw new Error('Item not found (ID ' + payload.id + '). Try refreshing.');
      balanceAfter = (Number(values[i][5]) || 0) + qty;
      values[i][5] = balanceAfter;
      itemId = values[i][0];
      itemName = values[i][2];
      category = values[i][1];
      unit = values[i][4];
      sheet.getRange(2, 1, values.length, INV_HEADERS.length).setValues(values);
    } else {
      // New item.
      itemName = String(payload.item || '').trim();
      category = String(payload.category || 'Uncategorized').trim() || 'Uncategorized';
      unit = String(payload.unit || 'pc').trim() || 'pc';
      const itemNotes = String(payload.itemNotes || '').trim();
      const target = Number(payload.target) || 0;
      if (!itemName) throw new Error('Please enter a name for the new item.');

      itemId = nextId_(values);
      balanceAfter = qty;
      sheet.appendRow([itemId, category, itemName, itemNotes, unit, qty, target]);
    }

    appendTransactions_([[
      new Date(), 'IN', itemId, itemName, category,
      qty, unit, source, handledBy, notes, balanceAfter
    ]]);

    return {
      ok: true,
      message: 'Recorded input of ' + qty + ' ' + unit + ' of "' + itemName + '".',
      dashboard: getDashboard()
    };
  } finally {
    lock.releaseLock();
  }
}

/* ============================ Helpers ================================= */

function mustSheet_(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('Sheet "' + name + '" is missing. Run setup() once from the editor.');
  return sheet;
}

function appendTransactions_(rows) {
  if (!rows.length) return;
  const sheet = mustSheet_(TX_SHEET);
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, TX_HEADERS.length).setValues(rows);
}

function nextId_(values) {
  var max = 0;
  values.forEach(function (r) {
    var n = Number(r[0]);
    if (!isNaN(n) && n > max) max = n;
  });
  return max + 1;
}

function formatTs_(d) {
  try {
    return Utilities.formatDate(new Date(d), Session.getScriptTimeZone(), 'MMM d, yyyy h:mm a');
  } catch (e) {
    return String(d);
  }
}
