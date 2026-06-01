/** 本番環境（rhr_action）— GitHub Pages 公開時は env.js としてコピーして使う */
window.APP_ENV = {
  id: "production",
  label: "本番",
  title: "行動指針ビューア",
  storageKey: "rhr-guideline-assessment",
  userNameKey: "rhr-guideline-user-name",
  myGradeKey: "rhr-guideline-my-grade",
  authSessionKey: "rhr_guideline_auth_v2",
  accessPasswordHash: "69349d0cdf7c997ff04732def28eb6ecaa21ab9a3cb2d3e2b6315258c043cb0b",
  minutesKey: "rhr-guideline-mtg-minutes",
  openaiApiKey: "",

  // Google Apps Script Web App（開発と同じ GAS を使う場合は apiUrl / apiToken を揃える）
  apiUrl: "https://script.google.com/macros/s/AKfycbyBWrz0NatEn8x-y20IB8mkQ4lJ3_yhohOe5LV2aW7ak_7C1mIGLUsQFLody0nKcXjGcQ/exec",
  apiToken: "rhr2026_guideline_runninghomeruninc_2014-2026"
};
