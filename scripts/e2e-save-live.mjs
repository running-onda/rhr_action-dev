/**
 * E2E against live GitHub Pages dev site
 */
import { chromium } from "playwright";

const API_URL =
  "https://script.google.com/macros/s/AKfycbyBWrz0NatEn8x-y20IB8mkQ4lJ3_yhohOe5LV2aW7ak_7C1mIGLUsQFLody0nKcXjGcQ/exec";
const TOKEN = "rhr2026_guideline_runninghomeruninc_2014-2026";
const SITE = "https://running-onda.github.io/rhr_action-dev";

async function createRoom() {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: TOKEN,
      action: "createRoom",
      employeeName: "本番確認テスト",
      gradeIndex: 2,
      gradeName: "スタメン",
      managerName: "確認上司"
    })
  });
  const json = await res.json();
  return json.data.roomId;
}

async function getAssessment(roomId) {
  const u = new URL(API_URL);
  u.searchParams.set("token", TOKEN);
  u.searchParams.set("action", "getAssessment");
  u.searchParams.set("roomId", roomId);
  const res = await fetch(u.toString());
  return (await res.json()).data;
}

async function main() {
  const roomId = await createRoom();
  const viewerUrl = `${SITE}/viewer.html?room=${roomId}&v=${Date.now()}`;
  console.log("Live test room:", roomId, viewerUrl);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("dialog", async d => {
    console.error("ALERT:", d.message());
    await d.dismiss();
  });

  await page.goto(viewerUrl, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector(".self-assess[data-assess-key]", { timeout: 30000 });

  const block = page.locator(".self-assess[data-assess-key]").first();
  await block.locator(".eval-self .rating-dot[data-rating='3']").click();
  await block.locator(".self-comment").fill("本番URL保存確認");

  await page.locator("#saveAllBtn").click();
  await page.waitForTimeout(8000);

  const api = await getAssessment(roomId);
  const count = Object.keys(api.assessments || {}).length;
  console.log("Saved keys:", count);

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector(".self-assess[data-assess-key]", { timeout: 30000 });

  const rating = await page.locator(".self-assess[data-assess-key]").first().locator(".eval-self .rating-dot.active").getAttribute("data-rating");
  const comment = await page.locator(".self-assess[data-assess-key]").first().locator(".self-comment").inputValue();

  await browser.close();

  const ok = count > 0 && rating === "3" && comment.includes("本番URL保存確認");
  if (!ok) {
    console.error("LIVE FAIL", { count, rating, comment });
    process.exit(1);
  }
  console.log("LIVE PASS");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
