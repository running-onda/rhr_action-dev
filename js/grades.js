/** 職級マスタ（昇格＝ティア間、昇級＝L/M/H 間） */
export const GRADE_TIERS = [
  { name: "育成", phase: "知る", hasRank: false, guidelineIndex: 0 },
  { name: "ファーム", phase: "試す", hasRank: true, guidelineIndex: 1 },
  { name: "スタメン", phase: "成果化する", hasRank: true, guidelineIndex: 2 },
  { name: "キャプテン", phase: "他者を巻き込む", hasRank: true, guidelineIndex: 3 },
  { name: "選手権監督", phase: "勝ち方を描く", hasRank: true, guidelineIndex: 4 },
  { name: "名球会", phase: "社会へ波及する", hasRank: true, guidelineIndex: 6 }
];

export const GRADE_RANKS = ["L", "M", "H"];

/** 行動指針の7段階表示用（旧 index.html 互換） */
export const GUIDELINE_GRADES = [
  { name: "育成選手", phase: "知る" },
  { name: "ファーム", phase: "試す" },
  { name: "スタメン", phase: "成果化する" },
  { name: "キャプテン", phase: "他者を巻き込む" },
  { name: "選手権監督", phase: "勝ち方を描く" },
  { name: "監督", phase: "組織を文化にする" },
  { name: "名球会", phase: "社会へ波及する" }
];

export function getTier(tierIndex) {
  const i = Number(tierIndex);
  return GRADE_TIERS[i] || null;
}

export function formatGradeLabel(tierIndex, rank) {
  const tier = getTier(tierIndex);
  if (!tier) return "未設定";
  const r = String(rank || "").trim().toUpperCase();
  if (!tier.hasRank || !r) return tier.name;
  return `${tier.name}${r}`;
}

export function guidelineIndexForTier(tierIndex) {
  const tier = getTier(tierIndex);
  return tier ? tier.guidelineIndex : 0;
}

export function tierIndexFromGuidelineIndex(guidelineIndex) {
  const g = Number(guidelineIndex);
  const found = GRADE_TIERS.find(t => t.guidelineIndex === g);
  if (found) return GRADE_TIERS.indexOf(found);
  if (g === 5) return 4;
  return 0;
}

export function parseLegacyGradeName(gradeName) {
  const name = String(gradeName || "").trim();
  if (!name) return { tierIndex: 0, rank: "" };

  if (name === "育成" || name === "育成選手") return { tierIndex: 0, rank: "" };

  const rankMatch = name.match(/^(育成|ファーム|スタメン|キャプテン|選手権監督|名球会)(L|M|H)?$/);
  if (rankMatch) {
    const tierName = rankMatch[1];
    const rank = rankMatch[2] || "";
    const tierIndex = GRADE_TIERS.findIndex(t => t.name === tierName);
    return { tierIndex: tierIndex >= 0 ? tierIndex : 0, rank };
  }

  const legacy = GUIDELINE_GRADES.findIndex(g => g.name === name || g.name.replace("選手", "") === name);
  if (legacy >= 0) {
    return { tierIndex: tierIndexFromGuidelineIndex(legacy), rank: "" };
  }

  return { tierIndex: 0, rank: "" };
}

export function normalizeRoomGrade(room) {
  if (!room) {
    return {
      tierIndex: 0,
      rank: "",
      beforeTierIndex: 0,
      beforeRank: "",
      afterTierIndex: null,
      afterRank: ""
    };
  }

  let tierIndex =
    room.gradeTierIndex !== undefined && room.gradeTierIndex !== ""
      ? Number(room.gradeTierIndex)
      : NaN;
  let rank = room.gradeRank !== undefined ? String(room.gradeRank || "") : "";

  if (!Number.isFinite(tierIndex)) {
    const parsed = parseLegacyGradeName(room.gradeName);
    tierIndex = parsed.tierIndex;
    rank = parsed.rank;
  }

  let beforeTierIndex =
    room.gradeBeforeTierIndex !== undefined && room.gradeBeforeTierIndex !== ""
      ? Number(room.gradeBeforeTierIndex)
      : tierIndex;
  let beforeRank =
    room.gradeBeforeRank !== undefined ? String(room.gradeBeforeRank || "") : rank;

  if (!Number.isFinite(beforeTierIndex)) {
    beforeTierIndex = tierIndex;
    beforeRank = rank;
  }

  const afterTierRaw = room.gradeAfterTierIndex;
  const afterTierIndex =
    afterTierRaw === null || afterTierRaw === undefined || afterTierRaw === ""
      ? null
      : Number(afterTierRaw);
  const afterRank = room.gradeAfterRank !== undefined ? String(room.gradeAfterRank || "") : "";

  return {
    tierIndex,
    rank,
    beforeTierIndex,
    beforeRank,
    afterTierIndex: Number.isFinite(afterTierIndex) ? afterTierIndex : null,
    afterRank
  };
}

export function roomGradeLabels(room) {
  const g = normalizeRoomGrade(room);
  return {
    current: formatGradeLabel(g.tierIndex, g.rank),
    before: formatGradeLabel(g.beforeTierIndex, g.beforeRank),
    after:
      g.afterTierIndex === null ? "" : formatGradeLabel(g.afterTierIndex, g.afterRank),
    guidelineIndex: guidelineIndexForTier(g.tierIndex)
  };
}
