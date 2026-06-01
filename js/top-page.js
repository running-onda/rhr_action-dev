import { createRoom, getRooms, isApiEnabled } from "./assessment-store.js";
import { formatApiError } from "./api.js";
import { buildViewerUrl } from "./room.js";

const grades = [
  { name: "育成選手", phase: "知る" },
  { name: "ファーム", phase: "試す" },
  { name: "スタメン", phase: "成果化する" },
  { name: "キャプテン", phase: "他者を巻き込む" },
  { name: "選手権監督", phase: "勝ち方を描く" },
  { name: "監督", phase: "組織を文化にする" },
  { name: "名球会", phase: "社会へ波及する" }
];

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDt(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "—";
  }
}

function setBusy(b) {
  $("createRoomBtn").disabled = b;
  $("refreshBtn").disabled = b;
}

function renderGradeOptions() {
  const sel = $("gradeSelect");
  sel.innerHTML = grades
    .map((g, i) => `<option value="${i}">${escapeHtml(g.name)}（${escapeHtml(g.phase)}）</option>`)
    .join("");
  sel.value = "2";
}

function setResult(roomId) {
  const roomUrl = buildViewerUrl(roomId);

  $("createResult").hidden = false;
  $("roomIdOut").textContent = roomId;
  $("roomUrlOut").textContent = roomUrl;
}

async function refreshRooms() {
  const tbody = $("roomsBody");
  tbody.innerHTML = `<tr><td colspan="5">読み込み中…</td></tr>`;
  try {
    const rooms = await getRooms(200);
    if (!rooms.length) {
      tbody.innerHTML = `<tr><td colspan="5">まだルームがありません。</td></tr>`;
      return;
    }

    tbody.innerHTML = rooms
      .map(r => {
        const roomUrl = buildViewerUrl(r.roomId);
        return `<tr>
          <td>${escapeHtml(r.employeeName || "")}</td>
          <td>${escapeHtml(r.gradeName || "")}</td>
          <td class="mono">${escapeHtml(r.roomId || "")}</td>
          <td>${escapeHtml(formatDt(r.updatedAt))}</td>
          <td><a href="${escapeHtml(roomUrl)}">評価シート</a></td>
        </tr>`;
      })
      .join("");
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5">取得に失敗しました: ${escapeHtml(formatApiError(e))}</td></tr>`;
  }
}

async function onCreateRoom() {
  const employeeName = $("employeeName").value.trim();
  const managerName = $("managerName").value.trim();
  const gradeIndex = Number($("gradeSelect").value);
  const gradeName = grades[gradeIndex]?.name || "";

  if (!employeeName) {
    alert("社員名を入力してください。");
    return;
  }

  setBusy(true);
  try {
    const r = await createRoom({ employeeName, managerName, gradeIndex, gradeName });
    setResult(r.roomId);
    await refreshRooms();
  } catch (e) {
    alert(`ルーム作成に失敗しました:\n${formatApiError(e)}`);
  } finally {
    setBusy(false);
  }
}

async function copyFrom(targetId) {
  const el = $(targetId);
  const text = (el && el.textContent) ? el.textContent.trim() : "";
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

function bindCopyButtons() {
  document.querySelectorAll("[data-copy-from]").forEach(btn => {
    btn.addEventListener("click", () => copyFrom(btn.getAttribute("data-copy-from")));
  });
}

function init() {
  renderGradeOptions();
  bindCopyButtons();

  if (!isApiEnabled()) {
    $("apiNotice").hidden = false;
    $("createRoomBtn").disabled = true;
    $("refreshBtn").disabled = true;
    return;
  }

  $("createRoomBtn").addEventListener("click", onCreateRoom);
  $("refreshBtn").addEventListener("click", () => refreshRooms());
  refreshRooms();
}

init();

