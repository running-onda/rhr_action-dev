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

function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : "{}";
    const body = JSON.parse(raw || "{}");

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
  const roomId = generateRoomId_(() => hasRoomId_(sh, roomId));
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
  // v0: minimal placeholder. Full aggregation can be added in Phase 7.
  // Here we return rooms with lastUpdatedAt only.
  const rooms = getRooms_({ limit: body.limit || 200 });
  return rooms.map(r => ({
    roomId: r.roomId,
    employeeName: r.employeeName,
    gradeName: r.gradeName,
    managerName: r.managerName,
    lastUpdatedAt: r.updatedAt
  }));
}

// -------------------------
// Helpers
// -------------------------

function getProp_(k) {
  return PropertiesService.getScriptProperties().getProperty(k);
}

function getSs_() {
  const id = String(getProp_("SPREADSHEET_ID") || "");
  if (!id) throw new Error("Missing SPREADSHEET_ID");
  return SpreadsheetApp.openById(id);
}

function ensureSheets_() {
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
    evaluator_role: map["evaluator_role"],
    supervisor_index: map["supervisor_index"],
    supervisor_name: map["supervisor_name"],
    rating: map["rating"],
    comment: map["comment"],
    updated_at: map["updated_at"]
  };
}
