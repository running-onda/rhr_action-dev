/** 職級マスタ（昇格＝ティア間、昇級＝L/M/H 間） */
export const GRADE_TIERS = [
  { name: "育成", phase: "知る", hasRank: false, guidelineIndex: 0 },
  { name: "ファーム", phase: "試す", hasRank: true, guidelineIndex: 1 },
  { name: "スタメン", phase: "成果化する", hasRank: true, guidelineIndex: 2 },
  { name: "キャプテン", phase: "他者を巻き込む", hasRank: true, guidelineIndex: 3 },
  { name: "選手権監督", phase: "勝ち方を描く", hasRank: true, guidelineIndex: 4 },
  { name: "監督", phase: "組織を文化にする", hasRank: true, guidelineIndex: 5 },
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
  return 0;
}

export function parseLegacyGradeName(gradeName) {
  const name = String(gradeName || "").trim();
  if (!name) return { tierIndex: 0, rank: "" };

  if (name === "育成" || name === "育成選手") return { tierIndex: 0, rank: "" };

  const rankMatch = name.match(/^(育成|ファーム|スタメン|キャプテン|選手権監督|監督|名球会)(L|M|H)?$/);
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

function normalizeRank(rank) {
  const r = String(rank || "").trim().toUpperCase();
  return r === "L" || r === "M" || r === "H" ? r : "L";
}

function scoreToScaleZone(score) {
  if (score <= 3.0) {
    return { targetRank: null, isDemotion: true, isTierPromo: false };
  }
  if (score < 3.4) {
    return { targetRank: "L", isDemotion: false, isTierPromo: false };
  }
  if (score < 3.7) {
    return { targetRank: "M", isDemotion: false, isTierPromo: false };
  }
  if (score < 4.0) {
    return { targetRank: "H", isDemotion: false, isTierPromo: false };
  }
  return { targetRank: null, isDemotion: false, isTierPromo: true };
}

/** 査定MTG前職級と上司評価平均から、評価後の想定職級を算出 */
export function inferAfterGrade(beforeTierIndex, beforeRank, managerAvg) {
  const score = Number(managerAvg);
  if (!Number.isFinite(score) || score <= 0) return null;

  const tierIdx = Number(beforeTierIndex);
  const tier = getTier(tierIdx);
  if (!tier) return null;

  if (tierIdx === 0) {
    if (score < 3.5) return { tierIndex: 0, rank: "" };
    return { tierIndex: 1, rank: "L" };
  }

  const zone = scoreToScaleZone(score);

  if (zone.isDemotion) {
    const newTier = Math.max(0, tierIdx - 1);
    const t = getTier(newTier);
    return { tierIndex: newTier, rank: t?.hasRank ? "L" : "" };
  }
  if (zone.isTierPromo) {
    if (tierIdx >= GRADE_TIERS.length - 1) {
      return { tierIndex: tierIdx, rank: "H" };
    }
    const newTier = tierIdx + 1;
    const t = getTier(newTier);
    return { tierIndex: newTier, rank: t?.hasRank ? "L" : "" };
  }

  return { tierIndex: tierIdx, rank: zone.targetRank };
}

export function roomGradeLabels(room, managerAvgOverride) {
  const g = normalizeRoomGrade(room);
  let after =
    g.afterTierIndex === null ? "" : formatGradeLabel(g.afterTierIndex, g.afterRank);

  if (!after) {
    const avg = Number(
      managerAvgOverride !== undefined && managerAvgOverride !== null
        ? managerAvgOverride
        : room?.managerAvg ?? room?.manager_avg ?? 0
    );
    if (avg > 0) {
      const inferred = inferAfterGrade(g.beforeTierIndex, g.beforeRank, avg);
      if (inferred) after = formatGradeLabel(inferred.tierIndex, inferred.rank);
    }
  }

  return {
    current: formatGradeLabel(g.tierIndex, g.rank),
    before: formatGradeLabel(g.beforeTierIndex, g.beforeRank),
    after,
    guidelineIndex: guidelineIndexForTier(g.tierIndex)
  };
}
