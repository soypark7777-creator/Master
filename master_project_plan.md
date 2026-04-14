# MASTER_PROJECT_PLAN.md

## 1. Project Title
**SoulTree Vision**

박효신 콘서트 영상을 실시간 분석하여, 아티스트의 퍼포먼스(포즈, 가창 상태)와 무대 연출(레이저, 폭죽/특수효과)을 데이터화하고 시각화하는 분석 대시보드를 구축한다.

---

## 2. Project Goal
이 프로젝트의 목표는 다음과 같다.

- 유튜브 콘서트 영상을 실시간 스트리밍으로 받아온다.
- 아티스트 1인을 중심으로 포즈를 추정한다.
- 마이크 사용 환경에서도 입/턱 주변 움직임을 분석하여 가창 여부를 추론한다.
- 강한 콘서트 조명, 백라이트, 레이저, 플래시 간섭을 견디는 분석 파이프라인을 만든다.
- 감지 결과를 SSE(Server-Sent Events)로 프런트엔드에 실시간 전송한다.
- Next.js 기반 대시보드에서 스켈레톤 오버레이, 감지 로그, 효과 이벤트 타임라인을 지연 없이 시각화한다.

---

## 3. Core Challenges
이 프로젝트에서 반드시 해결해야 할 핵심 과제는 다음과 같다.

### 3.1 Concert Lighting Interference
- 강한 무대 조명, 역광, 컬러 라이트, 레이저, 스모그로 인해 포즈 추정 정확도가 급격히 떨어질 수 있다.
- 영상 프레임별로 조도와 대비가 크게 바뀌므로 고정 임계값만으로는 안정적인 탐지가 어렵다.
- 따라서 **동적 confidence threshold 제어**와 **OpenCV 전처리**가 중요하다.

### 3.2 Singing Detection with Microphone Occlusion
- 콘서트 중 마이크가 입 주변을 가리기 때문에 일반적인 입 랜드마크 해석이 불안정할 수 있다.
- 입술, 턱, 고개 각도, 목 주변 움직임을 복합적으로 보고 **가창 여부를 추론하는 보조 로직**이 필요하다.

### 3.3 Low-Latency Visualization
- 분석 결과가 늦게 도착하면 대시보드의 실시간성이 무너진다.
- 프레임 처리량과 전송 빈도의 균형을 잡아야 한다.
- 프런트엔드는 수신된 데이터를 부드럽게 반영하면서도 과도한 리렌더링을 피해야 한다.

---

## 4. System Overview

### 4.1 Architecture
- **Backend:** Flask
- **Frontend:** Next.js
- **Streaming Communication:** SSE (Server-Sent Events)
- **Pose Engine:** MediaPipe Pose Heavy
- **Optional Object/Event Detector:** YOLO
- **Video Input:** yt-dlp 기반 유튜브 스트림 파이프라인
- **Frame Processing:** OpenCV

### 4.2 Data Flow
1. yt-dlp로 유튜브 영상 스트림 URL 확보
2. OpenCV로 프레임 읽기
3. OpenCV 전처리 수행
4. MediaPipe Pose Heavy로 랜드마크 추론
5. 입/턱/머리 움직임 기반 가창 상태 추론
6. 밝기/색 분포/히스토그램으로 레이저/폭죽 이벤트 감지
7. JSON 형태로 분석 결과 생성
8. Flask SSE 엔드포인트에서 프런트엔드로 스트리밍
9. Next.js 대시보드에서 영상, 스켈레톤, 로그 카드, 타임라인 렌더링

---

## 5. Common Technical Specifications

### 5.1 Communication Contract
Flask 백엔드와 Next.js 프런트엔드는 **SSE(Server-Sent Events)** 로 통신한다.

- Backend Port: `5000`
- Frontend Port: `3000`

### 5.2 Standard JSON Payload
아래 JSON 구조를 백엔드와 프런트엔드의 공통 데이터 계약으로 사용한다.

```json
{
  "artist_detected": true,
  "pose_landmarks": [
    { "x": 0.5, "y": 0.8, "z": 0.1 }
  ],
  "is_singing": true,
  "fx_events": {
    "pyro": false,
    "laser": true
  },
  "confidence_score": 0.89,
  "timestamp": "12:45.5"
}
```

### 5.3 Recommended Extended JSON Payload
실무 구현을 위해 아래와 같이 확장해도 좋다.

```json
{
  "artist_detected": true,
  "pose_landmarks": [
    { "x": 0.5, "y": 0.8, "z": 0.1, "visibility": 0.92 }
  ],
  "face_box": {
    "x": 412,
    "y": 120,
    "w": 180,
    "h": 180
  },
  "is_singing": true,
  "singing_confidence": 0.81,
  "fx_events": {
    "pyro": false,
    "laser": true,
    "flash": false
  },
  "frame_metrics": {
    "brightness": 183.2,
    "contrast": 41.8,
    "red_ratio": 0.14,
    "green_ratio": 0.26,
    "blue_ratio": 0.42
  },
  "confidence_score": 0.89,
  "processing_fps": 17.4,
  "timestamp": "12:45.5"
}
```

---

## 6. Backend Requirements (For VS Code Codex / Copilot)

### 6.1 Role
VS Code Codex 또는 Copilot은 다음 역할을 수행해야 한다.

- 유튜브 영상 스트리밍 파이프라인 구현
- 실시간 프레임 분석 엔진 구축
- Pose / Singing / FX 감지 로직 구현
- SSE 전송 API 구축
- 조명 간섭 대응용 동적 threshold API 구현

### 6.2 Main Implementation Tasks

#### A. Streamer
- `yt-dlp`를 사용해 유튜브 고화질 영상 스트림 URL을 확보한다.
- 분석 대상 영상은 라이브 또는 VOD 모두 가능하도록 설계한다.
- ffmpeg 또는 OpenCV `VideoCapture`와 연결 가능한 방식으로 구현한다.

#### B. Pose Estimation Engine
- `MediaPipe Pose (Heavy)` 모델을 사용한다.
- 아티스트의 전신 또는 상반신 기준 랜드마크를 추출한다.
- 포즈 신뢰도가 낮을 때는 이전 프레임 결과를 보조적으로 활용할 수 있도록 설계한다.

#### C. Singing Detection Logic
- 입 주변 및 턱 움직임 변화를 활용하여 `is_singing` 상태를 추론한다.
- 마이크가 입을 가리는 상황을 고려하여 다음 특징을 함께 사용한다.
  - 턱의 상하 움직임
  - 얼굴 하단 landmark 변화량
  - 목/고개 기울기 변화
  - 프레임 간 입 주변 displacement
- 출력은 boolean과 confidence score 둘 다 제공한다.

#### D. FX Detection Logic
- 화면 전체 또는 ROI 기준 밝기 변화량을 추적한다.
- HSV / RGB 채널 비율과 히스토그램을 분석하여 다음 이벤트를 구분한다.
  - `laser`
  - `pyro`
  - 필요 시 `flash`
- 레이저는 특정 색채 편향과 선형 밝기 패턴을 기준으로 감지한다.
- 폭죽은 순간적인 고휘도 상승과 국소 확산 패턴을 기준으로 감지한다.

#### E. Robustness and Preprocessing
- OpenCV 기반 전처리를 넣는다.
  - Contrast enhancement
  - CLAHE(optional)
  - Gamma correction(optional)
  - Noise reduction(optional)
- 조명 간섭을 줄이기 위해 `min_detection_confidence`와 `min_tracking_confidence`를 런타임에서 조절 가능하게 만든다.
- 분석 실패 프레임에서는 시스템이 멈추지 않고 graceful fallback 하도록 한다.

#### F. SSE API
- `/api/stream` 엔드포인트에서 분석된 JSON 데이터를 지속적으로 push한다.
- SSE 포맷 예시:

```text
data: {"artist_detected": true, "is_singing": false, ...}\n\n
```

### 6.3 Required Backend Files
아래 파일 구조를 기준으로 구현한다.

```bash
backend/
├─ app.py
├─ requirements.txt
├─ vision_engine.py
├─ stream_source.py
├─ detectors/
│  ├─ pose_detector.py
│  ├─ singing_detector.py
│  └─ fx_detector.py
├─ utils/
│  ├─ image_preprocess.py
│  ├─ sse.py
│  └─ timecode.py
└─ config.py
```

### 6.4 Backend API Design

#### `GET /api/stream`
역할:
- 유튜브 스트림을 분석하고 SSE로 데이터를 전송한다.

Query Parameters 예시:
- `url`: 유튜브 영상 URL
- `confidence`: 최소 detection confidence
- `tracking_confidence`: 최소 tracking confidence

응답:
- `Content-Type: text/event-stream`

#### `POST /api/config`
역할:
- 분석 엔진의 런타임 설정을 갱신한다.

요청 예시:
```json
{
  "min_detection_confidence": 0.65,
  "min_tracking_confidence": 0.55,
  "laser_sensitivity": 0.7,
  "pyro_sensitivity": 0.8
}
```

#### `GET /api/health`
역할:
- 서버 상태 확인

응답 예시:
```json
{
  "status": "ok"
}
```

### 6.5 Backend Implementation Rules
- 함수와 클래스 분리를 명확히 한다.
- 하드코딩을 피하고 `config.py` 또는 환경변수 기반으로 설정을 분리한다.
- 영상 스트림 끊김, 프레임 누락, 분석 실패 상황을 반드시 예외 처리한다.
- 프런트엔드가 소비하기 쉬운 안정적 JSON 스키마를 유지한다.
- 추후 멀티 아티스트 대응 가능성을 고려하되, 현재는 단일 메인 아티스트 기준으로 구현한다.

### 6.6 Prompt for VS Code Codex
아래 프롬프트를 VS Code Codex에 그대로 전달해도 된다.

```md
MASTER_PROJECT_PLAN.md를 기준으로 Flask 기반 실시간 영상 분석 백엔드를 구현해줘.

핵심 목표:
1. yt-dlp로 유튜브 스트림 URL을 가져오기
2. OpenCV로 프레임 처리하기
3. MediaPipe Pose Heavy로 포즈 랜드마크 추론하기
4. 입/턱 주변 움직임으로 is_singing 추론하기
5. 밝기/색상 히스토그램 기반으로 laser / pyro 이벤트 감지하기
6. /api/stream 엔드포인트에서 SSE로 JSON 데이터 전송하기
7. /api/config 엔드포인트에서 min_detection_confidence 등 런타임 파라미터 수정 가능하게 하기

반드시 지켜야 할 사항:
- vision_engine.py를 중심으로 구조화할 것
- config.py로 설정값 분리할 것
- 조명 간섭을 줄이기 위한 OpenCV 전처리 포함할 것
- 프레임 분석 실패 시 서버가 중단되지 않도록 예외 처리할 것
- JSON 스키마는 MASTER_PROJECT_PLAN.md의 계약을 따를 것
- 파일 구조는 backend/app.py, backend/vision_engine.py, backend/detectors/*, backend/utils/* 형태로 구성할 것
- requirements.txt도 함께 작성할 것

우선순위:
1. /api/stream SSE 완성
2. Pose detection 완성
3. Singing detection 보조 로직 추가
4. FX detection 추가
5. /api/config 연동

코드는 유지보수 가능하도록 클래스 기반 또는 모듈 분리 방식으로 작성해줘.
```

---

## 7. Frontend Requirements (For Claude Code)

### 7.1 Role
Claude Code는 다음 역할을 수행해야 한다.

- 실시간 분석 데이터를 시각화하는 대시보드 구현
- 영상 위에 포즈 스켈레톤을 오버레이 렌더링
- 가창 여부, FX 이벤트, confidence 조절 UI 구현
- 박효신 콘서트 감성에 맞는 다크 골드/화이트 네온 테마 구축

### 7.2 Main Implementation Tasks

#### A. Analysis Page
- `/analysis` 페이지를 중심으로 구성한다.
- 비디오 피드와 Canvas 레이어를 겹쳐 배치한다.
- Canvas에 실시간 스켈레톤을 렌더링한다.

#### B. Skeleton Overlay
- HTML5 Canvas를 사용한다.
- 랜드마크 좌표를 영상 해상도 기준으로 매핑한다.
- 주요 관절 점과 연결선을 부드럽게 그린다.
- 신뢰도가 낮은 랜드마크는 시각적으로 약하게 처리하거나 생략 가능하다.

#### C. Singing Visualization
- `is_singing === true`일 때 입 주변 또는 얼굴 주변에 시각 효과를 추가한다.
- 예:
  - `Singing Voice` 라벨
  - 은은한 파동 애니메이션
  - 골드/화이트 빛 번짐 효과

#### D. Control Panel
- 탐지 신뢰도 조절용 슬라이더 구현
- 슬라이더 값 변경 시 백엔드 `/api/config`에 즉시 반영
- 추가로 아래 항목도 패널에 둘 수 있다.
  - tracking confidence
  - laser sensitivity
  - pyro sensitivity
  - show/hide skeleton

#### E. FX Timeline
- 레이저 또는 폭죽 감지 시 타임스탬프 포함 로그 카드 자동 생성
- 카드 예시:
  - `[12:45.5] LASER DETECTED`
  - `[13:10.2] PYRO DETECTED`
- 이벤트가 너무 많으면 동일 구간을 적절히 debounce 또는 merge 한다.

#### F. Theme / Vibe
박효신 콘서트 분위기를 반영한 UI 스타일을 적용한다.

- 전체 테마: Dark Mode
- 포인트 컬러: Gold / White Neon
- 배경: 짙은 블랙, 딥 네이비, 은은한 조명 그라데이션
- 느낌: 고급스럽고 몰입감 있는 공연 분석 콘솔
- CSS: Tailwind CSS 사용

#### G. State Management
- SSE 연결로 들어오는 실시간 데이터를 안정적으로 관리한다.
- 불필요한 전체 리렌더링을 피한다.
- 최신 프레임 상태와 이벤트 로그 상태를 분리 관리한다.

### 7.3 Recommended Frontend File Structure

```bash
frontend/
├─ app/
│  ├─ page.tsx
│  ├─ analysis/
│  │  └─ page.tsx
│  └─ globals.css
├─ components/
│  ├─ VideoCanvasOverlay.tsx
│  ├─ ControlPanel.tsx
│  ├─ EventTimeline.tsx
│  ├─ StatusBadge.tsx
│  └─ NeonCard.tsx
├─ hooks/
│  └─ useSSEStream.ts
├─ lib/
│  ├─ drawSkeleton.ts
│  ├─ api.ts
│  └─ types.ts
└─ tailwind.config.ts
```

### 7.4 Frontend Implementation Rules
- 타입은 TypeScript로 명확히 작성한다.
- SSE 연결 해제와 재연결 로직을 포함한다.
- Canvas 크기와 video 해상도 동기화를 맞춘다.
- UI는 실시간 분석 도구처럼 깔끔하고 기능 중심으로 설계한다.
- 성능을 위해 빈번한 state update는 최소화한다.

### 7.5 Prompt for Claude Code
아래 프롬프트를 Claude Code에 전달하면 된다.

```md
MASTER_PROJECT_PLAN.md를 기준으로 Next.js + Tailwind CSS 기반 실시간 분석 대시보드를 구현해줘.

구현 목표:
1. /analysis 페이지 생성
2. 비디오 영역 위에 HTML5 Canvas를 겹쳐 스켈레톤 렌더링
3. SSE로 백엔드 /api/stream 데이터를 받아 실시간 상태 업데이트
4. is_singing이 true일 때 입 주변 또는 얼굴 주변에 Singing Voice 효과 표시
5. 레이저/폭죽 감지 이벤트를 타임라인 카드 형태로 누적 표시
6. confidence threshold 조절용 슬라이더 구현 후 백엔드 /api/config와 연동
7. 박효신 콘서트 감성의 다크 골드/화이트 네온 UI 적용

반드시 지켜야 할 사항:
- app/analysis/page.tsx를 중심으로 구성할 것
- 컴포넌트 분리: VideoCanvasOverlay, ControlPanel, EventTimeline
- TypeScript 타입 정의 포함할 것
- SSE 연결/해제 로직은 custom hook으로 분리할 것
- Canvas 좌표와 비디오 좌표를 정확히 맞출 것
- Tailwind로 고급스럽고 공연 콘솔 같은 분위기를 낼 것

추가 요구:
- 성능 저하 없이 실시간 UI가 부드럽게 보이도록 최적화할 것
- Event log는 타임스탬프 기준으로 깔끔하게 누적할 것
- confidence_score를 배지나 게이지로 시각화해줄 것
```

---

## 8. Integration Requirements

### 8.1 SSE Connection Contract
프런트엔드는 `EventSource`를 통해 백엔드 SSE 엔드포인트에 연결한다.

예시:
```ts
const source = new EventSource('http://localhost:5000/api/stream?url=YOUTUBE_URL&confidence=0.6');
```

수신 데이터는 JSON으로 파싱한다.

```ts
source.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
};
```

### 8.2 Real-Time Config Sync
프런트엔드 슬라이더 변경 시 다음이 즉시 반영되어야 한다.

- `min_detection_confidence`
- `min_tracking_confidence`
- 필요 시 `laser_sensitivity`
- 필요 시 `pyro_sensitivity`

예시:
```ts
await fetch('http://localhost:5000/api/config', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    min_detection_confidence: 0.7,
    min_tracking_confidence: 0.6
  })
});
```

### 8.3 Cross-Origin Setup
로컬 개발 환경에서는 CORS 설정을 추가한다.

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`

---

## 9. Execution Roadmap

### Step 1. Backend SSE First
가장 먼저 백엔드 `/api/stream` 엔드포인트를 완성한다.

필수 목표:
- 유튜브 스트림 열기
- 프레임 반복 처리
- 임시 또는 실제 분석 데이터 생성
- SSE로 지속 전송

### Step 2. Vision Engine
- `vision_engine.py` 중심으로 분석 엔진 구조 완성
- Pose detection 연동
- Singing detection 기초 로직 연동
- FX detection 기초 로직 연동

### Step 3. Frontend Analysis Page
- `/analysis` 페이지 생성
- 비디오 레이어 + Canvas 레이어 결합
- 수신된 랜드마크를 스켈레톤으로 그리기

### Step 4. Control Panel + Config API
- 슬라이더 구현
- `/api/config` 연동
- 실시간 threshold 반영 확인

### Step 5. Event Timeline
- 레이저/폭죽 이벤트 카드 누적 표시
- 타임스탬프 정렬 및 중복 이벤트 보정

### Step 6. Visual Polish
- 다크 골드/화이트 네온 스타일 적용
- Singing 효과, status badge, confidence 시각화 적용

---

## 10. Acceptance Criteria
프로젝트가 성공적으로 구현되었다고 볼 수 있는 기준은 아래와 같다.

### Backend Acceptance Criteria
- `/api/health`가 정상 응답한다.
- `/api/stream`에서 유효한 SSE 메시지가 지속적으로 전송된다.
- JSON 스키마가 프런트엔드 계약과 일치한다.
- `min_detection_confidence`가 런타임에서 변경 가능하다.
- 조명 간섭이 심한 프레임에서도 시스템이 중단되지 않는다.

### Frontend Acceptance Criteria
- `/analysis` 페이지에서 비디오와 캔버스가 정확히 겹친다.
- 스켈레톤이 영상 위에 자연스럽게 렌더링된다.
- `is_singing` 상태가 실시간 반영된다.
- 레이저/폭죽 이벤트가 타임라인에 누적된다.
- 슬라이더 변경값이 백엔드에 반영된다.
- 전체 UI가 다크 골드/화이트 네온 콘셉트로 일관성 있게 보인다.

### Integration Acceptance Criteria
- 백엔드와 프런트엔드가 로컬에서 동시에 정상 실행된다.
- SSE 수신이 끊겼을 때 재연결 또는 오류 안내가 동작한다.
- 실시간 데이터가 눈에 띄는 지연 없이 반영된다.

---

## 11. Suggested Environment Variables

```env
# backend/.env
FLASK_ENV=development
PORT=5000
DEFAULT_MIN_DETECTION_CONFIDENCE=0.6
DEFAULT_MIN_TRACKING_CONFIDENCE=0.5
DEFAULT_LASER_SENSITIVITY=0.7
DEFAULT_PYRO_SENSITIVITY=0.8
YTDLP_FORMAT=best
```

```env
# frontend/.env.local
NEXT_PUBLIC_API_BASE=http://localhost:5000
```

---

## 12. Suggested Dependencies

### Backend
```txt
flask
flask-cors
opencv-python
mediapipe
yt-dlp
numpy
python-dotenv
ultralytics
```

### Frontend
```txt
next
react
react-dom
typescript
tailwindcss
clsx
```

---

## 13. Recommended Initial Build Order
구현 우선순위는 반드시 아래 순서를 권장한다.

1. Flask 서버 기본 구조 생성
2. `/api/health` 구현
3. `/api/stream` SSE 더미 데이터 구현
4. 유튜브 스트림 연동
5. MediaPipe Pose 연동
6. JSON 스키마 고정
7. Next.js `/analysis` 페이지 생성
8. SSE 수신 Hook 작성
9. Canvas 스켈레톤 렌더링
10. Control Panel + `/api/config` 연동
11. Singing detection 시각 효과 추가
12. FX timeline 추가
13. 스타일 고도화

---

## 14. Final Instructions for AI Coding Tools

### For VS Code Codex
- `vision_engine.py`를 핵심 엔진 파일로 작성하라.
- 임계값이 동적으로 바뀌는 구조를 반드시 지원하라.
- 조명 간섭을 줄이기 위한 전처리와 예외 처리를 우선하라.
- `/api/stream` SSE가 가장 먼저 동작해야 한다.

### For Claude Code
- `/analysis` 페이지를 중심으로 실시간 대시보드를 구현하라.
- 영상 위 캔버스 스켈레톤과 이벤트 타임라인을 동시에 보여줘라.
- 박효신 콘서트 감성의 다크 골드/화이트 네온 스타일을 적용하라.
- 고급스럽고 몰입감 있는 공연 분석 UI를 만들어라.

---

## 15. One-Line Command Prompts

### Codex용 한 줄 지시문
```md
MASTER_PROJECT_PLAN.md를 참고해서 Flask 기반 backend를 구현해줘. vision_engine.py 중심으로 yt-dlp 스트림, MediaPipe Pose Heavy, singing detection, laser/pyro detection, /api/stream SSE, /api/config 동적 threshold 제어까지 포함해서 유지보수 가능한 구조로 작성해줘.
```

### Claude Code용 한 줄 지시문
```md
MASTER_PROJECT_PLAN.md를 참고해서 Next.js 기반 /analysis 페이지를 구현해줘. 실시간 SSE 수신, video + canvas skeleton overlay, Singing Voice 효과, FX timeline, confidence 슬라이더, 다크 골드/화이트 네온 공연 콘솔 UI까지 포함해줘.
```

---

## 16. Final Note
이 문서는 단순 아이디어 정리용이 아니라, **VS Code Codex / Copilot / Claude Code가 실제 구현에 바로 사용할 수 있는 실행 기준 문서**다.

따라서 아래 원칙을 유지한다.

- 기능보다 먼저 데이터 계약(JSON schema)을 고정한다.
- 가장 먼저 SSE 파이프라인을 완성한다.
- 그 다음 분석 엔진을 붙인다.
- 마지막에 UI 디테일을 올린다.
- 실시간성, 안정성, 유지보수성을 모두 고려한다.

