/**
 * daily.js
 * 매일 자정(KST) 실행 — Velog 새 글 감지 → Discord 링크 포스팅
 */

const https = require("https");
const fs = require("fs");
const { parseStringPromise } = require("xml2js");

const VELOG_USERNAME = process.env.VELOG_USERNAME;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const STATE_FILE = "state.json";

// ── 유틸 ──────────────────────────────────────────────────────────────────────

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

function httpPost(url, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const { hostname, pathname, search } = new URL(url);
    const req = https.request(
      {
        hostname,
        path: pathname + (search || ""),
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve(d));
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function loadState() {
  if (!fs.existsSync(STATE_FILE)) {
    return { posted_links: [], bomb_count: 0, weekly_log: {} };
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/** KST 기준 오늘 날짜 문자열 (YYYY-MM-DD) */
function todayKST() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  )
    .toISOString()
    .slice(0, 10);
}

// ── 메인 ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!VELOG_USERNAME || !DISCORD_WEBHOOK_URL) {
    console.error("❌ VELOG_USERNAME 또는 DISCORD_WEBHOOK_URL 환경변수 누락");
    process.exit(1);
  }

  // 1. RSS 파싱
  const rssUrl = `https://v2.velog.io/rss/@${VELOG_USERNAME}`;
  console.log(`📡 RSS 요청: ${rssUrl}`);
  const xml = await httpGet(rssUrl);
  const parsed = await parseStringPromise(xml);
  const items = parsed?.rss?.channel?.[0]?.item ?? [];

  if (items.length === 0) {
    console.log("ℹ️  RSS에 글이 없습니다.");
    return;
  }

  // 2. 상태 로드
  const state = loadState();
  const today = todayKST();
  let hasNewPost = false;

  // 3. 새 글 필터링 & 포스팅
  for (const item of items.reverse()) { // 오래된 것부터
    const link = (item.link?.[0] ?? "").trim();
    const title = (item.title?.[0] ?? "제목 없음").trim();

    if (!link || state.posted_links.includes(link)) continue;

    // Discord 전송
    console.log(`🆕 새 글 발견: ${title}`);
    await httpPost(DISCORD_WEBHOOK_URL, {
      embeds: [
        {
          title: `📝 ${title}`,
          url: link,
          color: 0x20c997,
          footer: { text: `@${VELOG_USERNAME} • Velog 새 글` },
          timestamp: new Date().toISOString(),
        },
      ],
    });

    state.posted_links.push(link);
    hasNewPost = true;
  }

  // 4. 오늘 날짜에 포스팅 여부 기록 (이미 true면 유지)
  if (!state.weekly_log[today]) {
    state.weekly_log[today] = hasNewPost;
  } else if (hasNewPost) {
    state.weekly_log[today] = true;
  }

  if (!hasNewPost) {
    console.log("✅ 새 글 없음.");
  }

  // 5. 90일 이전 weekly_log 정리 (파일 비대화 방지)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  for (const date of Object.keys(state.weekly_log)) {
    if (new Date(date) < cutoff) delete state.weekly_log[date];
  }

  saveState(state);
  console.log(`💾 상태 저장 완료. 오늘(${today}) 포스팅: ${state.weekly_log[today]}`);
}

main().catch((err) => { console.error("❌ 오류:", err); process.exit(1); });
