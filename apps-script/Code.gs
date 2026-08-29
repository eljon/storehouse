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

const INV_HEADERS = ['ID', 'Category', 'Item', 'Notes / Size', 'Unit', 'Quantity', 'Target', 'Expiry'];

// Items expiring within this many days count as "near expiry".
const NEAR_EXPIRY_DAYS = 90;
const TX_HEADERS  = ['Timestamp', 'Type', 'Item ID', 'Item', 'Category',
                     'Quantity', 'Unit', 'Party', 'Handled By', 'Notes', 'Balance After',
                     'Verified', 'Verified At', 'Signature', 'Signed At'];
const SIGNATURE_COL = 14;   // 1-based column of the recipient signature
const SIGNED_AT_COL = 15;   // 1-based column of when the recipient signed

const APP_TITLE = "Kalayaan Ward Bishop's Storehouse";

// Password for the Bishop's verification of input/output transactions.
// (Kept server-side; it is not exposed in the public front-end.)
const BISHOP_PASSWORD = 'widowsmite';

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

/* ============================ Web app API ============================= */
// Serves JSON so a static front-end (GitHub Pages) can read and write the
// Sheet. Responses are "simple requests" friendly, so the browser needs no
// CORS preflight — and no Google Cloud Console project is required.

function doGet(e) {
  return handleRequest_(e, false);
}

function doPost(e) {
  return handleRequest_(e, true);
}

function handleRequest_(e, isPost) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var body = {};
    if (isPost && e && e.postData && e.postData.contents) {
      try { body = JSON.parse(e.postData.contents) || {}; } catch (err) { body = {}; }
    }
    var action = body.action || params.action || 'dashboard';

    switch (action) {
      case 'ping':
        return jsonOut_({ ok: true, title: APP_TITLE });
      case 'verify':
        return jsonOut_({ ok: true, valid: String((body.password || params.password) || '') === BISHOP_PASSWORD });
      case 'verifyTx':
        return jsonOut_(verifyTransaction_(body));
      case 'dashboard':
        return jsonOut_({ ok: true, dashboard: getDashboard() });
      case 'transactions':
        return jsonOut_({ ok: true,
          transactions: getRecentTransactions(Number(params.limit || body.limit) || 20) });
      case 'output':
        return jsonOut_(recordOutput(body));
      case 'input':
        return jsonOut_(recordInput(body));
      case 'deleteItem':
        return jsonOut_(deleteItem_(body));
      case 'editItem':
        return jsonOut_(editItem_(body));
      case 'deleteTx':
        return jsonOut_(deleteTransaction_(body));
      case 'saveSignature':
        return jsonOut_(saveSignature_(body));
      case 'getSignature':
        return jsonOut_(getSignature_(body, params));
      default:
        return jsonOut_({ ok: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return jsonOut_({ ok: false, error: (err && err.message) ? err.message : String(err) });
  }
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ============================ Menu / setup ============================ */

/**
 * Adds a "Storehouse" menu to the Sheet so you can run setup with a click
 * instead of using the editor's function dropdown. Runs automatically each
 * time the spreadsheet is opened.
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('🏬 Storehouse')
      .addItem('① Set up / load starting data', 'menuSetup_')
      .addToUi();
  } catch (e) { /* no UI context (e.g. run from editor) — ignore */ }
}

/** Menu wrapper: runs setup() and shows a confirmation dialog. */
function menuSetup_() {
  const seeded = setup();
  try {
    const ui = SpreadsheetApp.getUi();
    ui.alert('🏬 Storehouse',
      seeded
        ? 'Done! The Inventory tab now has your ' + SEED_DATA.length + ' starting items.\n\n' +
          'Next: Deploy → New deployment → Web app to get your app link.'
        : 'Sheets are ready. Inventory already had data, so it was left as-is.',
      ui.ButtonSet.OK);
  } catch (e) { /* ignore if no UI */ }
}

/**
 * Run ONCE to build the sheets and load the starting inventory. Safe to
 * re-run: it only seeds the Inventory sheet when it is empty, and never
 * touches existing Transactions. Returns true if it seeded the items.
 */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const inv = getOrCreateSheet_(ss, INVENTORY_SHEET);
  const tx  = getOrCreateSheet_(ss, TX_SHEET);

  ensureHeaders_(inv, INV_HEADERS);
  ensureHeaders_(tx,  TX_HEADERS);

  // Keep the header rows current (adds the Expiry / Verified columns to older sheets).
  inv.getRange(1, 1, 1, INV_HEADERS.length).setValues([INV_HEADERS]);
  tx.getRange(1, 1, 1, TX_HEADERS.length).setValues([TX_HEADERS]);

  // Seed inventory only when there is no data yet (headers only).
  var seeded = false;
  if (inv.getLastRow() <= 1) {
    const rows = SEED_DATA.map(function (r, i) {
      const id = i + 1;                       // ID
      // Quantity & Target = checklist qty; Expiry blank (set it as you restock).
      return [id, r[0], r[1], r[2], r[3], r[4], r[4], ''];
    });
    inv.getRange(2, 1, rows.length, INV_HEADERS.length).setValues(rows);
    SpreadsheetApp.flush();                   // force the writes to appear immediately
    seeded = true;
  }

  formatInventorySheet_(inv);
  formatTransactionsSheet_(tx);

  ss.toast(seeded ? 'Loaded ' + SEED_DATA.length + ' items into Inventory.'
                  : 'Sheets ready (Inventory already had data).', APP_TITLE, 8);
  return seeded;
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
      const expiry = toDateStr_(r[7]);
      const exp = expiryInfo_(expiry);
      return {
        id: r[0],
        category: r[1],
        item: r[2],
        notes: r[3],
        unit: r[4],
        quantity: Number(r[5]) || 0,
        target: Number(r[6]) || 0,
        expiry: expiry,                 // 'yyyy-MM-dd' or ''
        daysToExpiry: exp.days,         // number or null
        expStatus: exp.status           // 'expired' | 'near' | 'ok' | 'none'
      };
    });

  items.sort(function (a, b) {
    if (a.category === b.category) return String(a.item).localeCompare(String(b.item));
    return String(a.category).localeCompare(String(b.category));
  });
  return items;
}

/** Normalizes a sheet expiry cell (Date or text) to 'yyyy-MM-dd' or ''. */
function toDateStr_(v) {
  if (v === '' || v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var s = String(v).trim();
  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  }
  return s; // leave anything unexpected as-is
}

/** Days until an expiry date and a status bucket. */
function expiryInfo_(dateStr) {
  if (!dateStr) return { days: null, status: 'none' };
  var m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return { days: null, status: 'none' };
  var exp = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var days = Math.round((exp.getTime() - today.getTime()) / 86400000);
  var status = days < 0 ? 'expired' : (days <= NEAR_EXPIRY_DAYS ? 'near' : 'ok');
  return { days: days, status: status };
}

/** Convenience payload the web UI loads on start / after each change. */
function getDashboard() {
  const items = getInventory();
  const categories = [];
  items.forEach(function (it) {
    if (categories.indexOf(it.category) === -1) categories.push(it.category);
  });
  var lowStock = 0, outOfStock = 0, totalUnits = 0, nearExpiry = 0, expired = 0;
  items.forEach(function (it) {
    totalUnits += it.quantity;
    if (it.quantity <= 0) outOfStock++;
    else if (it.target > 0 && it.quantity < it.target) lowStock++;
    if (it.expStatus === 'expired') { expired++; nearExpiry++; }
    else if (it.expStatus === 'near') nearExpiry++;
  });
  return {
    items: items,
    categories: categories,
    stats: {
      distinctItems: items.length,
      totalUnits: totalUnits,
      lowStock: lowStock,
      outOfStock: outOfStock,
      nearExpiry: nearExpiry,   // expiring within 90 days, incl. already expired
      expired: expired
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
  const startRow = last - n + 1;
  const values = sheet.getRange(startRow, 1, n, TX_HEADERS.length).getValues();
  const out = values.map(function (r, idx) {
    return {
      row: startRow + idx,            // absolute sheet row (stable; log is append-only)
      timestamp: r[0] ? formatTs_(r[0]) : '',
      type: r[1],
      itemId: r[2],
      item: r[3],
      category: r[4],
      quantity: r[5],
      unit: r[6],
      party: r[7],
      handledBy: r[8],
      notes: r[9],
      balanceAfter: r[10],
      verified: (r[11] === 'Yes' || r[11] === true),
      verifiedAt: r[12] ? formatTs_(r[12]) : '',
      signed: !!(r[13] && String(r[13]).length)   // boolean only; image fetched on demand
    };
  });
  return out.reverse(); // newest first
}

/** Save a recipient signature (data URL) onto the given transaction rows. */
function saveSignature_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    payload = payload || {};
    var sig = String(payload.signature || '');
    if (!sig) throw new Error('No signature provided.');
    var rows = payload.rows || [];
    if (!rows.length) throw new Error('No transaction rows to sign.');
    const sheet = mustSheet_(TX_SHEET);
    const last = sheet.getLastRow();
    var ts = new Date(), n = 0;
    rows.forEach(function (r) {
      r = Number(r);
      if (r >= 2 && r <= last) {
        sheet.getRange(r, SIGNATURE_COL).setValue(sig);
        sheet.getRange(r, SIGNED_AT_COL).setValue(ts);
        n++;
      }
    });
    return { ok: true, saved: n, signedAt: formatTs_(ts) };
  } finally {
    lock.releaseLock();
  }
}

/** Fetch the signature image + signed-at for a single transaction row. */
function getSignature_(body, params) {
  var row = Number((body && body.row) || (params && params.row));
  const sheet = mustSheet_(TX_SHEET);
  const last = sheet.getLastRow();
  if (!(row >= 2 && row <= last)) return { ok: false, error: 'Transaction not found.' };
  var when = sheet.getRange(row, SIGNED_AT_COL).getValue();
  return {
    ok: true,
    signature: sheet.getRange(row, SIGNATURE_COL).getValue() || '',
    signedAt: when ? formatTs_(when) : ''
  };
}

/**
 * Verify a single already-recorded transaction (from the History tab).
 * payload = { row: Number, password: String }. Stamps Verified='Yes' and a
 * Verified At timestamp. Returns { ok, row, verified, verifiedAt } or an error.
 */
function verifyTransaction_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    payload = payload || {};
    if (String(payload.password || '') !== BISHOP_PASSWORD) {
      return { ok: false, error: 'Incorrect password.' };
    }
    const row = Number(payload.row);
    const sheet = mustSheet_(TX_SHEET);
    const last = sheet.getLastRow();
    if (!(row >= 2 && row <= last) || !sheet.getRange(row, 2).getValue()) {
      return { ok: false, error: 'Transaction not found. Please refresh and try again.' };
    }
    const verifiedCol = 12, verifiedAtCol = 13;   // 1-based columns
    var ts = new Date();
    const already = (sheet.getRange(row, verifiedCol).getValue() === 'Yes');
    if (already) {
      const existing = sheet.getRange(row, verifiedAtCol).getValue();
      if (existing) ts = existing;
    } else {
      sheet.getRange(row, verifiedCol).setValue('Yes');
      sheet.getRange(row, verifiedAtCol).setValue(ts);
    }
    return { ok: true, row: row, verified: true, verifiedAt: formatTs_(ts) };
  } finally {
    lock.releaseLock();
  }
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
    const verified  = isBishopVerified_(payload);
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
                   want, values[i][4], recipient, handledBy, notes, balanceAfter,
                   verified ? 'Yes' : 'No', verified ? ts : '', '', '']);
    });

    range.setValues(values);
    const startRow = mustSheet_(TX_SHEET).getLastRow() + 1;   // rows about to be appended
    appendTransactions_(txRows);
    const createdRows = txRows.map(function (_, i) { return startRow + i; });

    return {
      ok: true,
      message: 'Distributed ' + lines.length + ' item(s) to ' + recipient + '.' +
               (verified ? ' Verified by the Bishop.' : ''),
      verified: verified,
      rows: createdRows,           // so the receipt can attach a signature
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
 *   expiry: String,      // optional 'yyyy-MM-dd'; when set, updates the item's expiry
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
    const expiry    = normExpiryInput_(payload.expiry);
    const verified  = isBishopVerified_(payload);

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
      if (expiry) values[i][7] = expiry;   // update expiry only when provided
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
      sheet.appendRow([itemId, category, itemName, itemNotes, unit, qty, target, expiry]);
    }

    var expNote = expiry ? (notes ? notes + ' ' : '') + '(exp ' + expiry + ')' : notes;
    var ts = new Date();
    appendTransactions_([[
      ts, 'IN', itemId, itemName, category,
      qty, unit, source, handledBy, expNote, balanceAfter,
      verified ? 'Yes' : 'No', verified ? ts : '', '', ''
    ]]);

    return {
      ok: true,
      message: 'Restocked ' + qty + ' ' + unit + ' of "' + itemName + '".' +
               (verified ? ' Verified by the Bishop.' : ''),
      verified: verified,
      dashboard: getDashboard()
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Delete an inventory item. Recorded as an OUTPUT of its remaining stock so
 * the audit trail keeps a record, then the Inventory row is removed.
 * payload = { id, handledBy, reason, verifyPassword }.
 */
function deleteItem_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    payload = payload || {};
    // Deleting requires the Bishop's password (authoritative check).
    var pw = payload.verifyPassword;
    if (pw === undefined || pw === null || pw === '') {
      throw new Error("The Bishop's password is required to delete an item.");
    }
    if (String(pw) !== BISHOP_PASSWORD) throw new Error('Incorrect password.');
    const verified = true;
    const handledBy = String(payload.handledBy || '').trim();
    const reason = String(payload.reason || '').trim() || 'Deleted';

    const sheet = mustSheet_(INVENTORY_SHEET);
    const last = sheet.getLastRow();
    if (last <= 1) throw new Error('Item not found. Please refresh.');
    const values = sheet.getRange(2, 1, last - 1, INV_HEADERS.length).getValues();
    var idx = -1;
    for (var k = 0; k < values.length; k++) {
      if (String(values[k][0]) === String(payload.id)) { idx = k; break; }
    }
    if (idx === -1) throw new Error('Item not found. Please refresh.');

    const r = values[idx];
    const qty = Number(r[5]) || 0;
    const ts = new Date();
    // Log the removal as an OUT of the remaining stock.
    appendTransactions_([[
      ts, 'OUT', r[0], r[2], r[1], qty, r[4], reason, handledBy,
      'Item deleted from inventory', 0, verified ? 'Yes' : 'No', verified ? ts : '', '', ''
    ]]);
    sheet.deleteRow(idx + 2);   // data starts at row 2

    return {
      ok: true,
      message: 'Deleted "' + r[2] + '" — recorded as a distribution of ' + qty + ' ' + r[4] + '.' +
               (verified ? ' Verified by the Bishop.' : ''),
      verified: verified,
      dashboard: getDashboard()
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Edit an item's descriptive fields (category, name, notes/size, unit, target,
 * expiry). Quantity is intentionally NOT editable here — stock changes go
 * through Restock / Distribute so the running-balance audit trail stays intact.
 * payload = { id, category, item, itemNotes, unit, target, expiry }.
 * Any field left undefined keeps its current value; expiry '' clears the date.
 */
function editItem_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    payload = payload || {};
    const id = payload.id;
    if (id === null || id === undefined || id === '') throw new Error('Missing item id.');

    const sheet = mustSheet_(INVENTORY_SHEET);
    const last = sheet.getLastRow();
    if (last <= 1) throw new Error('Item not found. Please refresh.');
    const values = sheet.getRange(2, 1, last - 1, INV_HEADERS.length).getValues();
    var idx = -1;
    for (var k = 0; k < values.length; k++) {
      if (String(values[k][0]) === String(id)) { idx = k; break; }
    }
    if (idx === -1) throw new Error('Item not found. Please refresh.');

    const r = values[idx];
    var keep = function (v, cur) { return (v === undefined || v === null) ? cur : v; };

    var name = String(keep(payload.item, r[2])).trim();
    if (!name) throw new Error('Item name cannot be empty.');
    var category = String(keep(payload.category, r[1])).trim() || 'Uncategorized';
    var notes = String(keep(payload.itemNotes, r[3])).trim();
    var unit = String(keep(payload.unit, r[4])).trim() || 'pc';

    var target = r[6];
    if (payload.target !== undefined && payload.target !== null) {
      if (payload.target === '') { target = 0; }
      else {
        var t = Number(payload.target);
        if (isNaN(t) || t < 0) throw new Error('Target must be a number of 0 or more.');
        target = t;
      }
    }

    var expiry = r[7];
    if (payload.expiry !== undefined) expiry = normExpiryInput_(payload.expiry);  // '' clears it

    r[1] = category; r[2] = name; r[3] = notes; r[4] = unit; r[6] = target; r[7] = expiry;
    sheet.getRange(idx + 2, 1, 1, INV_HEADERS.length).setValues([r]);

    return { ok: true, message: 'Updated "' + name + '".', dashboard: getDashboard() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Delete a single transaction from the log and reverse its effect on stock.
 * Deleting an OUT (distribution) returns the items to inventory; deleting an
 * IN (restock) removes them again. Requires the Bishop's password.
 * payload = { row: Number, verifyPassword: String }.
 */
function deleteTransaction_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    payload = payload || {};
    // Deleting a transaction rewrites the audit trail — require the password.
    var pw = payload.verifyPassword;
    if (pw === undefined || pw === null || pw === '') {
      throw new Error("The Bishop's password is required to delete a transaction.");
    }
    if (String(pw) !== BISHOP_PASSWORD) throw new Error('Incorrect password.');

    const txSheet = mustSheet_(TX_SHEET);
    const last = txSheet.getLastRow();
    const row = Number(payload.row);
    if (!(row >= 2 && row <= last)) {
      throw new Error('Transaction not found. Please refresh and try again.');
    }
    const rec = txSheet.getRange(row, 1, 1, TX_HEADERS.length).getValues()[0];
    if (!rec[1] || !rec[0]) {
      throw new Error('Transaction not found. Please refresh and try again.');
    }
    const type    = String(rec[1]);          // 'IN' or 'OUT'
    const itemId  = rec[2];
    const item    = rec[3];
    const unit    = rec[6];
    const qty     = Number(rec[5]) || 0;

    // Reverse the stock movement on the matching inventory item (if it still exists).
    var adjusted = false, newBalance = null;
    const invSheet = mustSheet_(INVENTORY_SHEET);
    const invLast = invSheet.getLastRow();
    if (invLast > 1 && itemId !== '' && itemId !== null) {
      const invVals = invSheet.getRange(2, 1, invLast - 1, INV_HEADERS.length).getValues();
      for (var i = 0; i < invVals.length; i++) {
        if (String(invVals[i][0]) === String(itemId)) {
          var cur = Number(invVals[i][5]) || 0;
          // Undoing an OUT puts stock back; undoing an IN takes it away.
          var delta = (type === 'OUT') ? qty : -qty;
          newBalance = cur + delta;
          if (newBalance < 0) newBalance = 0;
          invSheet.getRange(i + 2, 6).setValue(newBalance);
          adjusted = true;
          break;
        }
      }
    }

    txSheet.deleteRow(row);

    var label = (type === 'OUT') ? 'distribution' : 'restock';
    var stockMsg = adjusted
      ? (type === 'OUT'
          ? ' Returned ' + qty + ' ' + unit + ' to "' + item + '" (now ' + newBalance + ').'
          : ' Removed ' + qty + ' ' + unit + ' from "' + item + '" (now ' + newBalance + ').')
      : ' Item is no longer in inventory, so stock was not adjusted.';

    return {
      ok: true,
      message: 'Deleted the ' + label + ' of ' + qty + ' ' + unit + ' "' + item + '".' + stockMsg,
      type: type,
      adjusted: adjusted,
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

/** True when the payload carries the correct Bishop's verification password. */
function isBishopVerified_(payload) {
  var pw = payload && payload.verifyPassword;
  if (pw === undefined || pw === null || pw === '') return false;
  return String(pw) === BISHOP_PASSWORD;
}

/** Accepts '' or a 'yyyy-MM-dd' string; returns a clean 'yyyy-MM-dd' or ''. */
function normExpiryInput_(v) {
  if (v === '' || v === null || v === undefined) return '';
  var s = String(v).trim();
  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) throw new Error('Expiry date must look like YYYY-MM-DD.');
  return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
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
