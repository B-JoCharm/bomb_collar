/**
 * weekly.js
 * 매주 일요일 자정(KST) 실행 — 주간 포스팅 현황 정산 → 폭탄 카운트 업데이트
 *
 * 규칙:
 *   글 없던 날 수 - 1 = 이번 주 추가 폭탄 수
 *   (글 없던 날이 1일 이하면 폭탄 없음)
 */

const https = require("https");
const fs = require("fs");

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const VELOG_USERNAME = process.env.VELOG_USERNAME;
const STATE_FILE = "state.json";

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

/** KST 기준으로 이번 주 월~일 날짜 배열 반환 */
function getThisWeekDatesKST() {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  );
  const day = now.getDay(); // 0=일, 1=월 ... 6=토

  // 일요일(0)이면 당일 포함한 지난 7일(월~일)
  // 즉 today가 일요일이면 6일 전(월)부터 today(일)까지
  const daysFromMonday = day === 0 ? 6 : day - 1;

  const dates = [];
  for (let i = daysFromMonday; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates; // 월, 화, 수, 목, 금, 토, 일 순서
}

const DAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

function dateToKSTDayLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00+09:00");
  return DAY_LABEL[d.getDay()];
}

async function main() {
  if (!DISCORD_WEBHOOK_URL) {
    console.error("❌ DISCORD_WEBHOOK_URL 환경변수 누락");
    process.exit(1);
  }

  const state = loadState();
  const weekDates = getThisWeekDatesKST(); // 7일 (월~일)

  console.log(`📅 정산 대상 주간: ${weekDates[0]} ~ ${weekDates[weekDates.length - 1]}`);

  // 날짜별 포스팅 여부 집계
  let postedDays = 0;
  let missingDays = 0;
  const dayRows = [];

  for (const date of weekDates) {
    const posted = !!state.weekly_log[date];
    const label = dateToKSTDayLabel(date);
    if (posted) {
      postedDays++;
      dayRows.push(`✅ ${label} (${date})`);
    } else {
      missingDays++;
      dayRows.push(`❌ ${label} (${date})`);
    }
  }

  // 폭탄 계산: max(0, 글 없던 날 - 1)
  const newBombs = Math.max(0, missingDays - 1);
  const prevBombCount = state.bomb_count ?? 0;
  state.bomb_count = prevBombCount + newBombs;

  saveState(state);

  // Discord 메시지 구성
  const bombEmoji = "💣";
  const weekSummary = dayRows.join("\n");

  let resultLine = "";
  if (newBombs === 0) {
    resultLine = `🎉 이번 주 폭탄 없음! (글 없던 날: ${missingDays}일)`;
  } else {
    resultLine = `${bombEmoji.repeat(Math.min(newBombs, 10))} 폭탄 **${newBombs}개** 추가! (글 없던 날: ${missingDays}일)`;
  }

  const embedDescription =
    `${weekSummary}\n\n` +
    `${resultLine}\n\n` +
    `> 누적 폭탄 카운트: **${state.bomb_count}개** ${bombEmoji}`;

  console.log("📊 주간 정산 결과:\n" + embedDescription);

  await httpPost(DISCORD_WEBHOOK_URL, {
    embeds: [
      {
        title: `📊 주간 Velog 포스팅 정산 (${weekDates[0]} ~ ${weekDates[6]})`,
        description: embedDescription,
        color: newBombs > 0 ? 0xff4444 : 0x20c997,
        footer: { text: `@${VELOG_USERNAME ?? "Velog"} • 주간 정산` },
        timestamp: new Date().toISOString(),
      },
    ],
  });

  console.log("✅ 정산 완료.");
}

main().catch((err) => { console.error("❌ 오류:", err); process.exit(1); });
