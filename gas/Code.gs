/**
 * RHR Action Guideline - Apps Script Web API
 *
 * Script Properties:
 * - API_TOKEN: shared token
 * - SPREADSHEET_ID: target spreadsheet id
 *
 * Sheets (tabs):
 * - rooms
 * - assessments
 * - members (optional)
 * - settings (optional)
 */

const SHEET_ROOMS = "rooms";
const SHEET_ASSESSMENTS = "assessments";
const SHEET_MEMBERS = "members";
const SHEET_SETTINGS = "settings";
const PROJECT_TITLE = "RHR_行動指針_評定API";

function doGet(e) {
  // JSONP transport for cross-origin reads (optional)
  // GET params: action, token, callback, ...payload
  try {
    const p = (e && e.parameter) ? e.parameter : {};
    const token = String(p.token || "");
    assertToken(token);

    const action = String(p.action || "");
    if (!action) return jsonpError_(p.callback, "VALIDATION_ERROR", "Missing action");

    ensureSheets_();
    const body = p; // treat as payload map (strings)

    let data;
    switch (action) {
      case "createRoom":
        data = createRoom_({
          employeeName: body.employeeName,
          managerName: body.managerName,
          gradeIndex: Number(body.gradeIndex),
          gradeName: body.gradeName
        });
        break;
      case "getAssessment":
        data = getAssessment_({ roomId: body.roomId });
        break;
      case "getRooms":
        data = getRooms_({ limit: body.limit });
        break;
      case "getRoomSummary":
        data = getRoomSummary_({ roomId: body.roomId, limit: body.limit });
        break;
      default:
        return jsonpError_(p.callback, "VALIDATION_ERROR", "Unsupported action for GET");
    }
    return jsonpOk_(p.callback, data);
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    return jsonpError_((e && e.parameter && e.parameter.callback) || "", "INTERNAL_ERROR", msg);
  }
}

function doPost(e) {
  try {
    let body = parseBody_(e);
    if (e && e.parameter) {
      body = Object.assign({}, e.parameter, body);
    }
    body = normalizePostBody_(body);

    const token = body.token || (e && e.parameter && e.parameter.token) || "";
    assertToken(token);

    const action = String(body.action || "");
    if (!action) return jsonError("VALIDATION_ERROR", "Missing action");

    ensureSheets_();

    switch (action) {
      case "createRoom":
        return jsonOk_(createRoom_(body));
      case "saveAssessment":
        return jsonOk_(saveAssessment_(body));
      case "saveAssessmentBatch":
        return jsonOk_(saveAssessmentBatch_(body));
      case "getAssessment":
        return jsonOk_(getAssessment_(body));
      case "getRooms":
        return jsonOk_(getRooms_(body));
      case "getRoomSummary":
        return jsonOk_(getRoomSummary_(body));
      default:
        return jsonError("VALIDATION_ERROR", "Unknown action");
    }
  } catch (err) {
    return jsonError("INTERNAL_ERROR", String(err && err.message ? err.message : err));
  }
}

function assertToken(token) {
  const expected = String(getProp_("API_TOKEN") || "");
  if (!expected || token !== expected) {
    throw new Error("INVALID_TOKEN");
  }
}

function createRoom_(body) {
  const employeeName = String(body.employeeName || "").trim();
  const managerName = String(body.managerName || "").trim();
  const gradeIndex = Number(body.gradeIndex);
  const gradeName = String(body.gradeName || "").trim();

  if (!employeeName) throw new Error("VALIDATION_ERROR: employeeName");
  if (!Number.isFinite(gradeIndex)) throw new Error("VALIDATION_ERROR: gradeIndex");

  const ss = getSs_();
  const sh = ss.getSheetByName(SHEET_ROOMS);

  const now = new Date();
  const roomId = generateRoomId_(id => hasRoomId_(sh, id));
  const status = "active";

  sh.appendRow([
    roomId,
    employeeName,
    gradeIndex,
    gradeName,
    managerName,
    status,
    now,
    now
  ]);

  return {
    roomId: roomId,
    employeeName: employeeName,
    gradeIndex: gradeIndex,
    gradeName: gradeName,
    managerName: managerName,
    status: status,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };
}

function saveAssessment_(body) {
  const roomId = String(body.roomId || "").trim();
  const itemKey = String(body.itemKey || "").trim();
  const category = String(body.category || "").trim();
  const middle = String(body.middle || "").trim();
  const item = String(body.item || "").trim();
  const evaluatorRole = String(body.evaluatorRole || "").trim(); // employee | manager
  const supervisorIndex = Number(body.supervisorIndex || 0);
  const supervisorName = String(body.supervisorName || "").trim();
  const rating = Number(body.rating || 0);
  const comment = String(body.comment || "");

  if (!roomId) throw new Error("VALIDATION_ERROR: roomId");
  if (!itemKey) throw new Error("VALIDATION_ERROR: itemKey");
  if (!evaluatorRole) throw new Error("VALIDATION_ERROR: evaluatorRole");
  if (!Number.isFinite(supervisorIndex)) throw new Error("VALIDATION_ERROR: supervisorIndex");
  if (!Number.isFinite(rating)) throw new Error("VALIDATION_ERROR: rating");

  const ss = getSs_();
  const sh = ss.getSheetByName(SHEET_ASSESSMENTS);
  const now = new Date();

  const key = compositeKey_(roomId, itemKey, evaluatorRole, supervisorIndex);
  const rowIdx = findRowByKey_(sh, key, /*keyCol*/ 1);

  const row = [
    key,
    roomId,
    itemKey,
    category,
    middle,
    item,
    evaluatorRole,
    supervisorIndex,
    supervisorName,
    rating,
    comment,
    now
  ];

  if (rowIdx > 0) {
    sh.getRange(rowIdx, 1, 1, row.length).setValues([row]);
  } else {
    sh.appendRow(row);
  }

  touchRoomUpdatedAt_(roomId, now);

  return { roomId: roomId, itemKey: itemKey, updatedAt: now.toISOString() };
}

function saveAssessmentBatch_(body) {
  const roomId = String(body.roomId || "").trim();
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!roomId) throw new Error("VALIDATION_ERROR: roomId");
  if (!rows.length) throw new Error("VALIDATION_ERROR: rows");

  const ss = getSs_();
  const sh = ss.getSheetByName(SHEET_ASSESSMENTS);
  const now = new Date();

  // Build map pk -> rowIndex for quick upsert
  const values = sh.getDataRange().getValues();
  const pkToRow = new Map();
  for (let i = 1; i < values.length; i++) {
    const pk = String(values[i][0] || "");
    if (pk) pkToRow.set(pk, i + 1);
  }

  const updated = [];
  rows.forEach(r => {
    const itemKey = String(r.itemKey || "").trim();
    const category = String(r.category || "").trim();
    const middle = String(r.middle || "").trim();
    const item = String(r.item || "").trim();
    const evaluatorRole = String(r.evaluatorRole || "").trim();
    const supervisorIndex = Number(r.supervisorIndex || 0);
    const supervisorName = String(r.supervisorName || "").trim();
    const rating = Number(r.rating || 0);
    const comment = String(r.comment || "");

    if (!itemKey || !evaluatorRole || !Number.isFinite(supervisorIndex) || !Number.isFinite(rating)) return;

    const pk = compositeKey_(roomId, itemKey, evaluatorRole, supervisorIndex);
    const row = [
      pk,
      roomId,
      itemKey,
      category,
      middle,
      item,
      evaluatorRole,
      supervisorIndex,
      supervisorName,
      rating,
      comment,
      now
    ];

    const rowIdx = pkToRow.get(pk);
    if (rowIdx) sh.getRange(rowIdx, 1, 1, row.length).setValues([row]);
    else sh.appendRow(row);
    updated.push({ itemKey, evaluatorRole, supervisorIndex });
  });

  touchRoomUpdatedAt_(roomId, now);
  return { roomId, updatedCount: updated.length, updatedAt: now.toISOString() };
}

function getAssessment_(body) {
  const roomId = String(body.roomId || "").trim();
  if (!roomId) throw new Error("VALIDATION_ERROR: roomId");

  const ss = getSs_();
  const rooms = ss.getSheetByName(SHEET_ROOMS);
  const room = getRoomById_(rooms, roomId);
  if (!room) throw new Error("NOT_FOUND");

  // Pivot assessments rows into localStorage-like structure expected by frontend
  const sh = ss.getSheetByName(SHEET_ASSESSMENTS);
  const values = sh.getDataRange().getValues();
  if (values.length <= 1) return { room: room, assessments: {} };

  const header = values[0];
  const idx = indexMap_(header);
  const out = {};

  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    if (String(r[idx.room_id] || "") !== roomId) continue;

    const itemKey = String(r[idx.item_key] || "");
    const role = String(r[idx.evaluator_role] || "");
    const sidx = Number(r[idx.supervisor_index] || 0);
    const name = String(r[idx.supervisor_name] || "");
    const rating = Number(r[idx.rating] || 0);
    const comment = String(r[idx.comment] || "");
    const updatedAt = r[idx.updated_at] instanceof Date ? r[idx.updated_at].toISOString() : "";

    if (!out[itemKey]) out[itemKey] = { supervisors: [] };

    if (role === "employee") {
      out[itemKey].selfRating = rating;
      out[itemKey].selfComment = comment;
      out[itemKey].updatedAt = updatedAt;
    } else {
      while (out[itemKey].supervisors.length <= sidx) {
        out[itemKey].supervisors.push({ name: "", rating: 0, comment: "" });
      }
      out[itemKey].supervisors[sidx] = { name: name, rating: rating, comment: comment };
      out[itemKey].updatedAt = updatedAt || out[itemKey].updatedAt;
    }
  }

  return { room: room, assessments: out };
}

function getRooms_(body) {
  const limit = Math.max(1, Math.min(500, Number(body.limit || 200)));
  const ss = getSs_();
  const sh = ss.getSheetByName(SHEET_ROOMS);
  const values = sh.getDataRange().getValues();
  if (values.length <= 1) return [];
  const header = values[0];
  const idx = indexMapRooms_(header);

  const out = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    out.push(roomRowToObj_(r, idx));
  }
  out.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return out.slice(0, limit);
}

function getRoomSummary_(body) {
  const roomId = String(body.roomId || "").trim();
  if (roomId) {
    return getRoomDetailSummary_(roomId);
  }
  return getRoomsSummary_(Number(body.limit || 200));
}

// -------------------------
// Helpers
// -------------------------

function normalizePostBody_(body) {
  if (body && body.rowsJson && !body.rows) {
    try {
      body.rows = JSON.parse(String(body.rowsJson));
    } catch (err) {
      throw new Error("VALIDATION_ERROR: rowsJson");
    }
  }
  return body || {};
}

function parseBody_(e) {
  const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : "";
  const type = (e && e.postData && e.postData.type) ? String(e.postData.type) : "";

  if (type.indexOf("application/json") >= 0 || !type) {
    try {
      return JSON.parse(raw || "{}");
    } catch {
      return {};
    }
  }

  // form-urlencoded fallback (for iframe posts)
  if (type.indexOf("application/x-www-form-urlencoded") >= 0) {
    return parseQueryString_(raw || "");
  }

  return {};
}

function parseQueryString_(qs) {
  const out = {};
  (qs || "").split("&").forEach(pair => {
    if (!pair) return;
    const i = pair.indexOf("=");
    const k = i >= 0 ? pair.slice(0, i) : pair;
    const v = i >= 0 ? pair.slice(i + 1) : "";
    const key = decodeURIComponent(k.replace(/\+/g, " "));
    const val = decodeURIComponent(v.replace(/\+/g, " "));
    out[key] = val;
  });
  return out;
}

function getProp_(k) {
  return PropertiesService.getScriptProperties().getProperty(k);
}

function getSs_() {
  const id = String(getProp_("SPREADSHEET_ID") || "");
  if (!id) throw new Error("Missing SPREADSHEET_ID");
  return SpreadsheetApp.openById(id);
}

/** Apps Script エディタ左上のプロジェクト名を設定（Drive 上のファイル名） */
function ensureProjectName_() {
  try {
    const file = DriveApp.getFileById(ScriptApp.getScriptId());
    if (file.getName() !== PROJECT_TITLE) {
      file.setName(PROJECT_TITLE);
    }
  } catch (err) {
    // Drive 権限がない環境ではスキップ（API 本体には影響しない）
    console.warn("ensureProjectName_ skipped:", err);
  }
}

/** エディタから手動実行してプロジェクト名だけ変更する場合 */
function renameProjectOnce() {
  ensureProjectName_();
}

function ensureSheets_() {
  ensureProjectName_();
  const ss = getSs_();
  if (!ss.getSheetByName(SHEET_ROOMS)) {
    const sh = ss.insertSheet(SHEET_ROOMS);
    sh.appendRow([
      "room_id",
      "employee_name",
      "grade_index",
      "grade_name",
      "manager_name",
      "status",
      "created_at",
      "updated_at"
    ]);
  }
  if (!ss.getSheetByName(SHEET_ASSESSMENTS)) {
    const sh = ss.insertSheet(SHEET_ASSESSMENTS);
    sh.appendRow([
      "pk",
      "room_id",
      "item_key",
      "category",
      "middle",
      "item",
      "evaluator_role",
      "supervisor_index",
      "supervisor_name",
      "rating",
      "comment",
      "updated_at"
    ]);
  }

  if (!ss.getSheetByName(SHEET_MEMBERS)) {
    const sh = ss.insertSheet(SHEET_MEMBERS);
    sh.appendRow(["email", "name", "role"]);
  }

  if (!ss.getSheetByName(SHEET_SETTINGS)) {
    const sh = ss.insertSheet(SHEET_SETTINGS);
    sh.appendRow(["key", "value"]);
  }
}

function jsonOk_(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonError(code, message) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: code, message: message || "" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonpOk_(callback, data) {
  const cb = String(callback || "").trim();
  const payload = JSON.stringify({ ok: true, data: data });
  if (!cb) return ContentService.createTextOutput(payload).setMimeType(ContentService.MimeType.JSON);
  return ContentService
    .createTextOutput(`${cb}(${payload});`)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function jsonpError_(callback, code, message) {
  const cb = String(callback || "").trim();
  const payload = JSON.stringify({ ok: false, error: code, message: message || "" });
  if (!cb) return ContentService.createTextOutput(payload).setMimeType(ContentService.MimeType.JSON);
  return ContentService
    .createTextOutput(`${cb}(${payload});`)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function generateRoomId_(existsFn) {
  for (let i = 0; i < 5; i++) {
    const id = randomId_(8);
    if (!existsFn(id)) return id;
  }
  throw new Error("INTERNAL_ERROR: roomId collision");
}

function randomId_(len) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function hasRoomId_(roomsSheet, roomId) {
  const values = roomsSheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0] || "") === roomId) return true;
  }
  return false;
}

function compositeKey_(roomId, itemKey, role, supervisorIndex) {
  return [roomId, itemKey, role, String(supervisorIndex)].join("||");
}

function findRowByKey_(sheet, key, keyCol) {
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][keyCol - 1] || "") === key) return i + 1; // 1-indexed row
  }
  return -1;
}

function touchRoomUpdatedAt_(roomId, now) {
  const ss = getSs_();
  const rooms = ss.getSheetByName(SHEET_ROOMS);
  const values = rooms.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0] || "") === roomId) {
      rooms.getRange(i + 1, 8).setValue(now); // updated_at col
      return;
    }
  }
}

function getRoomById_(roomsSheet, roomId) {
  const values = roomsSheet.getDataRange().getValues();
  if (values.length <= 1) return null;
  const header = values[0];
  const idx = indexMapRooms_(header);
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    if (String(r[idx.room_id] || "") === roomId) return roomRowToObj_(r, idx);
  }
  return null;
}

function roomRowToObj_(row, idx) {
  const createdAt = row[idx.created_at] instanceof Date ? row[idx.created_at].toISOString() : "";
  const updatedAt = row[idx.updated_at] instanceof Date ? row[idx.updated_at].toISOString() : "";
  return {
    roomId: String(row[idx.room_id] || ""),
    employeeName: String(row[idx.employee_name] || ""),
    gradeIndex: Number(row[idx.grade_index] || 0),
    gradeName: String(row[idx.grade_name] || ""),
    managerName: String(row[idx.manager_name] || ""),
    status: String(row[idx.status] || ""),
    createdAt: createdAt,
    updatedAt: updatedAt
  };
}

function indexMapRooms_(header) {
  const map = {};
  header.forEach((h, i) => (map[String(h)] = i));
  return {
    room_id: map["room_id"] ?? 0,
    employee_name: map["employee_name"] ?? 1,
    grade_index: map["grade_index"] ?? 2,
    grade_name: map["grade_name"] ?? 3,
    manager_name: map["manager_name"] ?? 4,
    status: map["status"] ?? 5,
    created_at: map["created_at"] ?? 6,
    updated_at: map["updated_at"] ?? 7
  };
}

function indexMap_(header) {
  const map = {};
  header.forEach((h, i) => (map[String(h)] = i));
  return {
    room_id: map["room_id"],
    item_key: map["item_key"],
    category: map["category"],
    middle: map["middle"],
    item: map["item"],
    evaluator_role: map["evaluator_role"],
    supervisor_index: map["supervisor_index"],
    supervisor_name: map["supervisor_name"],
    rating: map["rating"],
    comment: map["comment"],
    updated_at: map["updated_at"]
  };
}

function getRoomsSummary_(limit) {
  const ss = getSs_();
  const roomsSheet = ss.getSheetByName(SHEET_ROOMS);
  const roomsValues = roomsSheet.getDataRange().getValues();
  if (roomsValues.length <= 1) return [];
  const roomsHeader = roomsValues[0];
  const ridx = indexMapRooms_(roomsHeader);

  const rooms = [];
  for (let i = 1; i < roomsValues.length; i++) {
    rooms.push(roomRowToObj_(roomsValues[i], ridx));
  }

  // Aggregate assessments for averages + lastUpdatedAt
  const aSheet = ss.getSheetByName(SHEET_ASSESSMENTS);
  const aValues = aSheet.getDataRange().getValues();
  if (aValues.length <= 1) {
    return rooms
      .map(r => ({
        roomId: r.roomId,
        employeeName: r.employeeName,
        gradeName: r.gradeName,
        managerName: r.managerName,
        selfAvg: 0,
        managerAvg: 0,
        lastUpdatedAt: r.updatedAt
      }))
      .slice(0, limit);
  }
  const aHeader = aValues[0];
  const aidx = indexMap_(aHeader);

  const agg = new Map(); // roomId -> {selfSum,selfCount, mgr0Sum,mgr0Count, last}

  for (let i = 1; i < aValues.length; i++) {
    const r = aValues[i];
    const roomId = String(r[aidx.room_id] || "");
    if (!roomId) continue;
    const role = String(r[aidx.evaluator_role] || "");
    const sidx = Number(r[aidx.supervisor_index] || 0);
    const rating = Number(r[aidx.rating] || 0);
    const updatedAt = r[aidx.updated_at] instanceof Date ? r[aidx.updated_at].toISOString() : "";

    if (!agg.has(roomId)) agg.set(roomId, { selfSum: 0, selfCount: 0, mgrSum: 0, mgrCount: 0, last: "" });
    const a = agg.get(roomId);
    if (updatedAt && updatedAt > a.last) a.last = updatedAt;

    if (rating > 0 && role === "employee") {
      a.selfSum += rating;
      a.selfCount += 1;
    }
    if (rating > 0 && role === "manager" && sidx === 0) {
      a.mgrSum += rating;
      a.mgrCount += 1;
    }
  }

  const out = rooms.map(r => {
    const a = agg.get(r.roomId) || { selfSum: 0, selfCount: 0, mgrSum: 0, mgrCount: 0, last: "" };
    const selfAvg = a.selfCount ? a.selfSum / a.selfCount : 0;
    const mgrAvg = a.mgrCount ? a.mgrSum / a.mgrCount : 0;
    return {
      roomId: r.roomId,
      employeeName: r.employeeName,
      gradeName: r.gradeName,
      managerName: r.managerName,
      selfAvg: selfAvg,
      managerAvg: mgrAvg,
      lastUpdatedAt: a.last || r.updatedAt
    };
  });

  out.sort((a, b) => String(b.lastUpdatedAt).localeCompare(String(a.lastUpdatedAt)));
  return out.slice(0, Math.max(1, Math.min(500, limit)));
}

function getRoomDetailSummary_(roomId) {
  const ss = getSs_();
  const roomsSheet = ss.getSheetByName(SHEET_ROOMS);
  const room = getRoomById_(roomsSheet, roomId);
  if (!room) throw new Error("NOT_FOUND");

  const aSheet = ss.getSheetByName(SHEET_ASSESSMENTS);
  const aValues = aSheet.getDataRange().getValues();
  if (aValues.length <= 1) {
    return { room: room, byCategory: [], byMiddle: [], items: [], comments: [] };
  }
  const aHeader = aValues[0];
  const aidx = indexMap_(aHeader);

  // itemKey -> {category,middle,item,selfRating, mgrRating, selfComment, mgrComment, mgrName}
  const map = {};
  let last = "";

  for (let i = 1; i < aValues.length; i++) {
    const r = aValues[i];
    if (String(r[aidx.room_id] || "") !== roomId) continue;
    const itemKey = String(r[aidx.item_key] || "");
    const category = String(r[aidx.category] || "");
    const middle = String(r[aidx.middle] || "");
    const item = String(r[aidx.item] || "");
    const role = String(r[aidx.evaluator_role] || "");
    const sidx = Number(r[aidx.supervisor_index] || 0);
    const sname = String(r[aidx.supervisor_name] || "");
    const rating = Number(r[aidx.rating] || 0);
    const comment = String(r[aidx.comment] || "");
    const updatedAt = r[aidx.updated_at] instanceof Date ? r[aidx.updated_at].toISOString() : "";
    if (updatedAt && updatedAt > last) last = updatedAt;

    if (!map[itemKey]) map[itemKey] = { itemKey, category, middle, item, selfRating: 0, managerRating: 0, selfComment: "", managerComment: "", managerName: "" };
    const it = map[itemKey];
    if (role === "employee") {
      it.selfRating = rating;
      it.selfComment = comment;
    } else if (role === "manager" && sidx === 0) {
      it.managerRating = rating;
      it.managerComment = comment;
      it.managerName = sname;
    }
  }

  const items = Object.keys(map).map(k => map[k]);

  const byCategoryMap = new Map();
  const byMiddleMap = new Map();
  const comments = [];

  items.forEach(it => {
    const cKey = it.category;
    if (!byCategoryMap.has(cKey)) byCategoryMap.set(cKey, { category: it.category, selfSum: 0, selfCount: 0, mgrSum: 0, mgrCount: 0 });
    const c = byCategoryMap.get(cKey);
    if (it.selfRating > 0) { c.selfSum += it.selfRating; c.selfCount += 1; }
    if (it.managerRating > 0) { c.mgrSum += it.managerRating; c.mgrCount += 1; }

    const mKey = `${it.category}::${it.middle}`;
    if (!byMiddleMap.has(mKey)) byMiddleMap.set(mKey, { category: it.category, middle: it.middle, selfSum: 0, selfCount: 0, mgrSum: 0, mgrCount: 0 });
    const m = byMiddleMap.get(mKey);
    if (it.selfRating > 0) { m.selfSum += it.selfRating; m.selfCount += 1; }
    if (it.managerRating > 0) { m.mgrSum += it.managerRating; m.mgrCount += 1; }

    if (it.selfComment) comments.push({ role: "employee", itemKey: it.itemKey, category: it.category, middle: it.middle, item: it.item, comment: it.selfComment });
    if (it.managerComment) comments.push({ role: "manager", itemKey: it.itemKey, category: it.category, middle: it.middle, item: it.item, comment: it.managerComment, name: it.managerName });
  });

  const byCategory = [...byCategoryMap.values()].map(x => ({
    category: x.category,
    selfAvg: x.selfCount ? x.selfSum / x.selfCount : 0,
    managerAvg: x.mgrCount ? x.mgrSum / x.mgrCount : 0
  }));

  const byMiddle = [...byMiddleMap.values()].map(x => ({
    category: x.category,
    middle: x.middle,
    selfAvg: x.selfCount ? x.selfSum / x.selfCount : 0,
    managerAvg: x.mgrCount ? x.mgrSum / x.mgrCount : 0
  }));

  return { room: room, lastUpdatedAt: last || room.updatedAt, byCategory, byMiddle, items, comments };
}
