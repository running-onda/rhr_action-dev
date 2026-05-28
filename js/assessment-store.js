import { apiCall, getApiConfig } from "./api.js";

// Data shape is intentionally close to current index.html localStorage format:
// assessments[itemKey] = { selfRating, selfComment, supervisors: [{name,rating,comment}], updatedAt }

export function isApiEnabled() {
  const { apiUrl, apiToken } = getApiConfig();
  return Boolean(apiUrl && apiToken);
}

export async function getAssessment(roomId) {
  return await apiCall("getAssessment", { roomId });
}

export async function saveAssessment(input) {
  // input: { roomId, itemKey, category, middle, item, evaluatorRole, supervisorIndex, supervisorName, rating, comment }
  return await apiCall("saveAssessment", input);
}

export async function createRoom(input) {
  // input: { employeeName, gradeIndex, gradeName, managerName }
  return await apiCall("createRoom", input);
}

export async function getRooms(limit = 200) {
  return await apiCall("getRooms", { limit });
}

