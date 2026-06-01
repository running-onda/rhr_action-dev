import { getAssessment, isApiEnabled } from "./assessment-store.js";
import {
  roomGradeLabels,
  inferAfterGrade,
  normalizeRoomGrade,
  formatGradeLabel,
  guidelineIndexForTier,
  tierIndexFromGuidelineIndex
} from "./grades.js";

window.RHR_GRADES = {
  roomGradeLabels,
  inferAfterGrade,
  normalizeRoomGrade,
  formatGradeLabel,
  guidelineIndexForTier,
  tierIndexFromGuidelineIndex
};

const ROOM_SESSION_KEY = "rhr-current-room-id";

export function getInsightsRoomId() {
  const fromUrl = new URLSearchParams(window.location.search).get("room");
  return String(fromUrl || sessionStorage.getItem(ROOM_SESSION_KEY) || "").trim();
}

export function isInsightsRoomLink() {
  return Boolean(getInsightsRoomId());
}

export async function fetchInsightsData() {
  const roomId = getInsightsRoomId();
  if (roomId && isApiEnabled()) {
    const res = await getAssessment(roomId);
    return {
      assessments: res.assessments || {},
      room: res.room || null,
      roomId,
      source: "gas"
    };
  }

  const STORAGE_KEY = window.APP_ENV?.storageKey || "rhr-guideline-dev-assessment";
  const STORAGE_KEY_PROD = "rhr-guideline-self-assessment";
  let assessments = {};
  try {
    assessments = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY_PROD) || "{}"
    );
  } catch {
    assessments = {};
  }

  return { assessments, room: null, roomId: roomId || "", source: "local" };
}

window.__fetchInsightsData = fetchInsightsData;
window.__getInsightsRoomId = getInsightsRoomId;
window.__isInsightsRoomLink = isInsightsRoomLink;
