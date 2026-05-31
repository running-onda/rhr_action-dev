/** 開発環境（rhr_action-dev）— 本番とは localStorage / 認証を分離 */
window.APP_ENV = {
  id: "development",
  label: "開発版",
  title: "行動指針ビューア（開発版）",
  storageKey: "rhr-guideline-dev-assessment",
  userNameKey: "rhr-guideline-dev-user-name",
  myGradeKey: "rhr-guideline-dev-my-grade",
  authSessionKey: "rhr_guideline_auth_dev_v2",
  accessPasswordHash: "69349d0cdf7c997ff04732def28eb6ecaa21ab9a3cb2d3e2b6315258c043cb0b",
  minutesKey: "rhr-guideline-dev-mtg-minutes",
  openaiApiKey: "",

  // Google Apps Script Web App
  // - apiUrl: GAS のデプロイURL（/exec）
  // - apiToken: GAS 側（スクリプトプロパティ）と一致させる
  apiUrl: "https://script.google.com/macros/s/AKfycbyBWrz0NatEn8x-y20IB8mkQ4lJ3_yhohOe5LV2aW7ak_7C1mIGLUsQFLody0nKcXjGcQ/exec",
  apiToken: "rhr2026_guideline_runninghomeruninc_2014"
};
