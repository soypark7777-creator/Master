# SoulTree Vision — 다음 세션 인수인계

> 작성일: 2026-04-14  
> 프로젝트: K-pop 콘서트 실시간 분석 대시보드 (박효신 콘서트 기준)  
> 저장소: https://github.com/soypark7777-creator/Master (branch: `main`)

---

## 현재 상태 요약

백엔드·프런트엔드 핵심 기능은 모두 구현 완료.  
**단, 프런트엔드가 "Application error"로 뜨는 문제가 미해결 상태.**

---

## 즉시 해결해야 할 문제 (최우선)

### Application error — React hydration mismatch

**원인**: 구 버전 dev 서버(PID 5772)가 포트 3000에 살아있는 채로 HMR이 새 클라이언트 코드를 밀어넣어 SSR↔클라이언트 불일치 발생.

**해결 방법** — PowerShell에서 순서대로 실행:

```powershell
# 1. 구 서버 프로세스 강제 종료
taskkill /f /pid 5772

# 2. Next.js 빌드 캐시 삭제
Remove-Item -Recurse -Force "C:\Users\User\Desktop\PROJECT\Master_Project\.next"

# 3. 개발 서버 재시작
cd "C:\Users\User\Desktop\PROJECT\Master_Project"
npm run dev
```

서버가 `✓ Ready` 메시지를 출력하면 브라우저에서 **Ctrl + Shift + R** (강제 새로고침).

> ※ PID가 5772가 아닐 수 있음. 현재 포트 점유 PID 확인:  
> `netstat -ano | findstr ":3000"`

---

## 정상 동작 확인 체크리스트

재시작 후 `http://localhost:3000/analysis`에서 아래 항목 확인:

- [ ] 상단 상태 뱃지 **5개** (기존 4개 + "응원봉 팬 감지 N개")
- [ ] 유튜브 URL 입력 → 스트림 연결 시 영상 패널에 **실제 영상** 표시 (MJPEG)
- [ ] 영상 패널 좌상단에 **"Live Analysis Feed"** + **REC** 깜빡이 뱃지
- [ ] 우측 패널에 **Fan Counter** 카드 (응원봉 개수 + 군중 밀도 게이지)
- [ ] 플라스크 백엔드가 실행 중이어야 스트림 가능 (`backend/start_backend.ps1`)

---

## 서버 시작 방법

### 백엔드 (Flask, 포트 5000)
```powershell
cd "C:\Users\User\Desktop\PROJECT\Master_Project"
.\backend\start_backend.ps1
```

### 프런트엔드 (Next.js, 포트 3000)
```powershell
cd "C:\Users\User\Desktop\PROJECT\Master_Project"
npm run dev
```

---

## 구현 완료된 기능 목록

| 기능 | 파일 | 상태 |
|------|------|------|
| YouTube yt-dlp 프록시 우회 | `backend/stream_source.py` | ✅ |
| OpenCV FFmpeg 백엔드로 YouTube 읽기 | `backend/stream_source.py` | ✅ |
| MJPEG 실시간 영상 스트리밍 | `backend/app.py`, `backend/utils/frame_buffer.py` | ✅ |
| 응원봉/글로우스틱 감지 (HSV) | `backend/detectors/crowd_detector.py` | ✅ |
| 영상 패널 실시간 표시 | `components/VideoCanvasOverlay.tsx` | ✅ |
| 팬 카운터 대시보드 표시 | `components/AnalysisDashboard.tsx` | ✅ |
| 포즈 스켈레톤 오버레이 | `components/VideoCanvasOverlay.tsx`, `lib/drawSkeleton.ts` | ✅ |
| FX 이벤트 감지 (레이저/파이로/플래시) | `backend/detectors/fx_detector.py` | ✅ |
| 노래 감지 | `backend/detectors/singing_detector.py` | ✅ |

---

## 다음에 할 수 있는 개선 작업

### 기능 개선
- [ ] **응원봉 색상별 분류** — 팬덤 색(예: 박효신 = 연두색)만 필터링해서 "공식 팬" 수 표시
- [ ] **타임라인 저장** — 분석 이벤트(레이저, 파이로 등)를 JSON으로 내보내기
- [ ] **스켈레톤 + 실시간 영상 동시 표시** — 현재는 MJPEG OR 스켈레톤 중 하나만 표시됨; 캔버스를 영상 위에 올려 둘 다 보이게 수정
- [ ] **다중 아티스트 감지** — 현재는 1인 포즈만 처리; 멀티 포즈 랜드마크 지원
- [ ] **클립 저장 버튼** — 특정 순간 스크린샷 또는 클립 저장 기능

### 안정성
- [ ] **스트림 자동 재연결** — YouTube URL 만료(보통 6시간) 시 자동으로 yt-dlp 재실행
- [ ] **백엔드 health check UI** — 현재 `/api/health` 는 있으나 프런트에서 시각화 미흡

### 배포
- [ ] **Docker Compose** — 백엔드(Flask) + 프런트엔드(Next.js) 한 번에 올리는 구성
- [ ] **환경변수 정리** — `.env.local.example` 기반으로 실제 `.env.local` 세팅 문서화

---

## 주요 파일 구조

```
Master_Project/
├── app/                        # Next.js 페이지
│   └── analysis/page.tsx       # 분석 대시보드 진입점
├── components/
│   ├── AnalysisDashboard.tsx   # 메인 대시보드 (팬 카운터, 뱃지 포함)
│   └── VideoCanvasOverlay.tsx  # 영상 + 스켈레톤 캔버스
├── backend/
│   ├── app.py                  # Flask 앱 (SSE + MJPEG 엔드포인트)
│   ├── vision_engine.py        # 프레임 처리 파이프라인
│   ├── stream_source.py        # YouTube → OpenCV 스트림 (yt-dlp + CAP_FFMPEG)
│   ├── detectors/
│   │   ├── crowd_detector.py   # 응원봉/글로우스틱 감지
│   │   ├── pose_detector.py    # MediaPipe 포즈
│   │   ├── fx_detector.py      # 레이저·파이로·플래시
│   │   └── singing_detector.py # 노래 여부
│   └── utils/
│       └── frame_buffer.py     # MJPEG용 스레드 안전 프레임 버퍼
└── lib/
    ├── types.ts                # 공유 타입 (AnalysisFrame 등)
    └── drawSkeleton.ts         # 캔버스 스켈레톤 렌더러
```

---

## 알려진 기술 이슈 및 해결책

| 문제 | 원인 | 해결 |
|------|------|------|
| `[WinError 10061]` yt-dlp 연결 거부 | Windows 시스템 프록시(WinHTTP) 오작동 | `stream_source.py`: 첫 시도 실패 시 `proxy: ""` 옵션으로 재시도 |
| `Could not open stream source` OpenCV | 기본 백엔드가 URL 쿼리스트링을 이미지 시퀀스로 오해 | `cv2.VideoCapture(url, cv2.CAP_FFMPEG)` 강제 지정 |
| Application error (hydration) | 구 dev 서버 + HMR 신규 코드 불일치 | `.next` 삭제 후 서버 재시작 |
| 영상 안 보임 | `isLive=false` 또는 백엔드 미실행 | 백엔드 먼저 실행 → 스트림 연결 후 `isLive=true` 로 전환 |
