# SoulTree Vision 실행 체크리스트

## 1. 현재 헬스체크 해석
- `status: ok` 이면 Flask 서버는 살아 있습니다.
- `pose_engine.ready: true` 여야 실제 포즈 추론이 가능합니다.
- `pose_engine.backend: unknown` 이면 MediaPipe 자체가 아직 정상 로드되지 않은 상태입니다.
- `reason` 에 `numpy.core.umath failed to import` 가 보이면 `.venv`가 시스템 Python 패키지와 충돌한 경우가 가장 유력합니다.

## 2. 우선 복구 순서
1. 기존 백엔드 프로세스를 종료합니다.
2. 프로젝트 루트에서 아래 명령으로 가상환경을 복구합니다.

```powershell
powershell -ExecutionPolicy Bypass -File .\backend\repair_env.ps1
```

3. 복구가 끝나면 백엔드를 다시 시작합니다.

```powershell
powershell -ExecutionPolicy Bypass -File .\backend\start_backend.ps1
```

4. 헬스체크를 다시 확인합니다.

```text
http://127.0.0.1:5000/api/health
```

## 3. 정상 상태 기준
- `status: "ok"`
- `pose_engine.ready: true`
- `pose_engine.backend: "mediapipe_tasks"`
- `pose_engine.model_path` 에 `pose_landmarker_heavy.task` 경로가 표시됨

## 4. 프론트엔드 실행
- 루트 `.env.local` 확인

```env
NEXT_PUBLIC_API_BASE=http://localhost:5000
NEXT_PUBLIC_ANALYSIS_VIDEO_URL=
NEXT_PUBLIC_ANALYSIS_STREAM_URL=
```

- 실행

```powershell
npm run dev
```

- 접속

```text
http://127.0.0.1:3000/analysis
```

## 5. 실제 스트림 붙이기
- 유튜브 URL이 있으면 아래처럼 열면 됩니다.

```text
http://127.0.0.1:3000/analysis?url=https://www.youtube.com/watch?v=VIDEO_ID
```

- 또는 `backend/.env` 의 `DEFAULT_STREAM_URL` 에 기본 URL을 넣어도 됩니다.

## 6. 화면에서 확인할 것
- `Stream State` 가 `SSE Live`
- `Pose Engine` 이 `Ready`
- `Landmarks` 가 0보다 큼
- `Singing` 상태 변화가 보임
- `FX Timeline` 에 `LASER`, `PYRO`, `FLASH` 누적
- 슬라이더 변경 시 `/api/config` 즉시 반영

## 7. 아직 문제가 있으면
- `backend: unknown` 이면 `.venv` 복구가 제대로 안 된 것입니다.
- `model_path: null` 이면 `backend/models/pose_landmarker_heavy.task` 파일 경로를 다시 확인합니다.
- `Stream Error` 이면 유튜브 URL, `yt-dlp`, 네트워크 상태를 확인합니다.
