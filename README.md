# 📢 Velog Discord 봇

Velog 새 글을 매일 자정 Discord에 포스팅하고,  
주간 포스팅 현황을 정산해서 **폭탄 카운트**를 관리합니다.

---

## 🗂️ 파일 구조

```
velog-bot/
├── .github/workflows/velog-bot.yml  # GitHub Actions 스케줄
├── daily.js                          # 매일 자정: 새 글 감지 & 링크 포스팅
├── weekly.js                         # 일요일 자정: 주간 정산 & 폭탄 카운트
├── state.json                        # 상태 저장 (포스팅 목록, 폭탄 수, 날짜 기록)
└── package.json
```

---

## 💣 폭탄 카운트 규칙

| 글 없던 날 | 추가 폭탄 |
|:---:|:---:|
| 0일 | 0개 |
| 1일 | 0개 |
| 2일 | 1개 |
| 3일 | 2개 |
| N일 | N-1개 |

매주 일요일 자정에 그 주(월~일) 기록을 보고 정산합니다.

---

## 🚀 설치 (5단계)

### 1단계 — GitHub 레포 생성 후 파일 업로드

```bash
git init
git add .
git commit -m "init"
git remote add origin https://github.com/아이디/레포명.git
git push -u origin main
```

---

### 2단계 — Discord Webhook URL 발급

1. 알림 받을 Discord 채널 → ⚙️ **채널 편집**
2. **연동** 탭 → **웹후크** → **새 웹후크**
3. 이름 입력 후 **웹후크 URL 복사**

---

### 3단계 — GitHub Secrets 등록

레포 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret 이름 | 값 |
|---|---|
| `VELOG_USERNAME` | Velog 아이디 (`@` 제외, 예: `john`) |
| `DISCORD_WEBHOOK_URL` | 복사한 Webhook URL |

---

### 4단계 — Actions 쓰기 권한 허용

레포 → **Settings** → **Actions** → **General**  
→ **Workflow permissions** → ✅ **Read and write permissions** 선택 → 저장

> `state.json`을 커밋하려면 쓰기 권한이 필요합니다.

---

### 5단계 — 동작 테스트

레포 → **Actions** 탭 → `Velog 포스팅 봇` → **Run workflow**

- `mode: daily` → 새 글 포스팅 테스트
- `mode: weekly` → 주간 정산 테스트

---

## ⏰ 스케줄

| 작업 | 실행 시각 |
|---|---|
| 새 글 포스팅 | 매일 KST 자정 (00:00) |
| 주간 정산 | 매주 일요일 KST 자정 (00:00) |

> GitHub Actions cron은 UTC 기준이므로, KST 자정 = UTC 전날 15:00으로 설정됩니다.

---

## 📊 Discord 메시지 예시

**새 글 알림**
```
📝 [글 제목]
   링크
@username • Velog 새 글
```

**주간 정산 (일요일)**
```
📊 주간 Velog 포스팅 정산 (2026-05-18 ~ 2026-05-24)

✅ 월 (2026-05-18)
✅ 화 (2026-05-19)
❌ 수 (2026-05-20)
✅ 목 (2026-05-21)
❌ 금 (2026-05-22)
✅ 토 (2026-05-23)
✅ 일 (2026-05-24)

💣💣 폭탄 1개 추가! (글 없던 날: 2일)

> 누적 폭탄 카운트: 3개 💣
```

---

## 🛠️ 폭탄 카운트 수동 리셋

`state.json`에서 `"bomb_count"` 값을 `0`으로 수정 후 커밋하면 됩니다.

```json
{
  "bomb_count": 0
}
```
