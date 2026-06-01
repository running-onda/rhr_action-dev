import { createRoom, getRooms, isApiEnabled } from "./assessment-store.js";
import { formatApiError } from "./api.js";
import { buildViewerUrl } from "./room.js";
import {
  GRADE_TIERS,
  GRADE_RANKS,
  formatGradeLabel,
  roomGradeLabels
} from "./grades.js";

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

function showLoading(message = "処理中…") {
  const overlay = $("loadingOverlay");
  const msg = $("loadingMessage");
  if (msg) msg.textContent = message;
  if (overlay) overlay.hidden = false;
}

function hideLoading() {
  const overlay = $("loadingOverlay");
  if (overlay) overlay.hidden = true;
}

function syncRankSelect() {
  const tierIndex = Number($("gradeTierSelect").value);
  const tier = GRADE_TIERS[tierIndex];
  const rankSel = $("gradeRankSelect");
  if (!tier || !tier.hasRank) {
    rankSel.disabled = true;
    rankSel.innerHTML = `<option value="">—</option>`;
    rankSel.value = "";
    return;
  }
  rankSel.disabled = false;
  rankSel.innerHTML = GRADE_RANKS.map(r => `<option value="${r}">${r}</option>`).join("");
  if (!GRADE_RANKS.includes(rankSel.value)) rankSel.value = "L";
}

function renderGradeOptions() {
  const tierSel = $("gradeTierSelect");
  tierSel.innerHTML = GRADE_TIERS.map(
    (g, i) => `<option value="${i}">${escapeHtml(g.name)}（${escapeHtml(g.phase)}）</option>`
  ).join("");
  tierSel.value = "2";
  syncRankSelect();
}

function setResult(roomId) {
  const roomUrl = buildViewerUrl(roomId);
  $("createResult").hidden = false;
  $("roomIdOut").textContent = roomId;
  $("roomUrlOut").textContent = roomUrl;
}

async function refreshRooms() {
  const tbody = $("roomsBody");
  tbody.innerHTML = `<tr><td colspan="6">読み込み中…</td></tr>`;
  showLoading("ルーム一覧を読み込んでいます…");
  try {
    const rooms = await getRooms(200);
    if (!rooms.length) {
      tbody.innerHTML = `<tr><td colspan="6">まだルームがありません。</td></tr>`;
      return;
    }

    tbody.innerHTML = rooms
      .map(r => {
        const labels = roomGradeLabels(r);
        const roomUrl = buildViewerUrl(r.roomId);
        return `<tr>
          <td>${escapeHtml(r.employeeName || "")}</td>
          <td>${escapeHtml(labels.before)}</td>
          <td>${escapeHtml(labels.after || "—")}</td>
          <td class="mono">${escapeHtml(r.roomId || "")}</td>
          <td>${escapeHtml(formatDt(r.updatedAt))}</td>
          <td><a href="${escapeHtml(roomUrl)}">評価シート</a></td>
        </tr>`;
      })
      .join("");
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6">取得に失敗しました: ${escapeHtml(formatApiError(e))}</td></tr>`;
  } finally {
    hideLoading();
  }
}

async function onCreateRoom() {
  const employeeName = $("employeeName").value.trim();
  const managerName = $("managerName").value.trim();
  const gradeTierIndex = Number($("gradeTierSelect").value);
  const gradeRank = $("gradeRankSelect").disabled ? "" : $("gradeRankSelect").value;
  const gradeName = formatGradeLabel(gradeTierIndex, gradeRank);

  if (!employeeName) {
    alert("社員名を入力してください。");
    return;
  }

  setBusy(true);
  showLoading("ルームを作成しています…");
  try {
    const r = await createRoom({
      employeeName,
      managerName,
      gradeTierIndex,
      gradeRank,
      gradeName
    });
    setResult(r.roomId);
    await refreshRooms();
  } catch (e) {
    alert(`ルーム作成に失敗しました:\n${formatApiError(e)}`);
  } finally {
    setBusy(false);
    hideLoading();
  }
}

async function copyFrom(targetId) {
  const el = $(targetId);
  const text = el && el.textContent ? el.textContent.trim() : "";
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
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
  $("gradeTierSelect").addEventListener("change", syncRankSelect);

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
