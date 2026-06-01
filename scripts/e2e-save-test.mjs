/**
 * E2E: room save persistence via viewer.html
 * Run: node scripts/e2e-save-test.mjs
 */
import { chromium } from "playwright";
import { createServer } from "http";
import { readFileSync, statSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const PORT = 8765;
const API_URL =
  "https://script.google.com/macros/s/AKfycbyBWrz0NatEn8x-y20IB8mkQ4lJ3_yhohOe5LV2aW7ak_7C1mIGLUsQFLody0nKcXjGcQ/exec";
const TOKEN = "rhr2026_guideline_runninghomeruninc_2014-2026";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8"
};

function startServer() {
  return new Promise(resolve => {
    const server = createServer((req, res) => {
      const path = req.url.split("?")[0].replace(/^\//, "") || "index.html";
      const filePath = join(ROOT, decodeURIComponent(path));
      try {
        const buf = readFileSync(filePath);
        const ext = extname(filePath);
        res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
        res.end(buf);
      } catch {
        res.writeHead(404);
        res.end("not found");
      }
    });
    server.listen(PORT, () => resolve(server));
  });
}

async function createRoom() {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: TOKEN,
      action: "createRoom",
      employeeName: "E2Eテスト社員",
      gradeIndex: 2,
      gradeName: "スタメン",
      managerName: "E2E上司"
    })
  });
  const json = await res.json();
  if (!json.ok) throw new Error("createRoom failed: " + JSON.stringify(json));
  return json.data.roomId;
}

async function getAssessment(roomId) {
  const u = new URL(API_URL);
  u.searchParams.set("token", TOKEN);
  u.searchParams.set("action", "getAssessment");
  u.searchParams.set("roomId", roomId);
  const res = await fetch(u.toString());
  const json = await res.json();
  return json.data;
}

async function main() {
  const server = await startServer();
  const roomId = await createRoom();
  const base = `http://127.0.0.1:${PORT}`;
  const viewerUrl = `${base}/viewer.html?room=${roomId}`;

  console.log("roomId:", roomId);
  console.log("viewer:", viewerUrl);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on("dialog", async d => {
    console.error("DIALOG:", d.message());
    await d.dismiss();
  });

  await page.goto(viewerUrl, { waitUntil: "networkidle" });

  await page.waitForSelector(".self-assess[data-assess-key]", { timeout: 15000 });

  const firstBlock = page.locator(".self-assess[data-assess-key]").first();
  await firstBlock.locator(".eval-self .rating-dot[data-rating='4']").click();
  await firstBlock.locator(".self-comment").fill("E2E本人コメント");

  await page.locator("#saveAllBtn").click();
  await page.waitForTimeout(6000);

  const apiAfterSave = await getAssessment(roomId);
  const keys = Object.keys(apiAfterSave.assessments || {});
  console.log("API after save keys:", keys.length, keys.slice(0, 3));

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector(".self-assess[data-assess-key]", { timeout: 15000 });

  const activeDot = page.locator(".self-assess[data-assess-key]").first().locator(".eval-self .rating-dot.active");
  const activeRating = await activeDot.getAttribute("data-rating");
  const comment = await page.locator(".self-assess[data-assess-key]").first().locator(".self-comment").inputValue();

  console.log("UI after reload rating:", activeRating, "comment:", comment);

  await browser.close();
  server.close();

  const ok =
    keys.length > 0 &&
    Number(apiAfterSave.assessments[keys[0]]?.selfRating) === 4 &&
    activeRating === "4" &&
    comment.includes("E2E本人コメント");

  if (!ok) {
    console.error("FAIL: save persistence check failed");
    process.exit(1);
  }
  console.log("PASS: save persistence verified");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
