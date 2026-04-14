"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ControlPanel } from "@/components/ControlPanel";
import { EventTimeline } from "@/components/EventTimeline";
import { NeonCard } from "@/components/NeonCard";
import { StatusBadge } from "@/components/StatusBadge";
import { VideoCanvasOverlay } from "@/components/VideoCanvasOverlay";
import { useSSEStream } from "@/hooks/useSSEStream";
import { API_BASE, getConfig, getHealth } from "@/lib/api";
import { BackendHealth, ConfigState } from "@/lib/types";

const INITIAL_CONFIG: ConfigState = {
  min_detection_confidence: 0.6,
  min_tracking_confidence: 0.5,
  laser_sensitivity: 0.7,
  pyro_sensitivity: 0.8,
  showSkeleton: true
};

function formatConnectionLabel(state: string) {
  if (state === "live") return "SSE Live";
  if (state === "error") return "Stream Error";
  if (state === "connecting") return "Connecting";
  return "Idle";
}

/** 응원봉 수를 보기 좋게 표현 */
function formatFanCount(count: number): string {
  if (count === 0) return "—";
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

/** crowd_density(0~1)를 막대 단계(0~5)로 변환 */
function densityBars(density: number): number {
  return Math.round(density * 5);
}

type AnalysisDashboardProps = {
  initialStreamSourceUrl?: string;
};

export function AnalysisDashboard({
  initialStreamSourceUrl
}: AnalysisDashboardProps) {
  const [config, setConfig] = useState<ConfigState>(INITIAL_CONFIG);
  const [backendHealth, setBackendHealth] = useState<BackendHealth | null>(null);
  const [streamSourceUrl, setStreamSourceUrl] = useState(
    initialStreamSourceUrl ?? ""
  );
  const [draftStreamUrl, setDraftStreamUrl] = useState(
    initialStreamSourceUrl ?? ""
  );

  const { currentFrame, timeline, connectionState, lastError } = useSSEStream({
    config,
    streamSourceUrl: streamSourceUrl || undefined
  });

  useEffect(() => {
    setStreamSourceUrl(initialStreamSourceUrl ?? "");
    setDraftStreamUrl(initialStreamSourceUrl ?? "");
  }, [initialStreamSourceUrl]);

  useEffect(() => {
    let active = true;

    getConfig()
      .then((backendConfig) => {
        if (!active) return;
        setConfig((current) => ({
          ...current,
          min_detection_confidence: backendConfig.min_detection_confidence,
          min_tracking_confidence: backendConfig.min_tracking_confidence,
          laser_sensitivity: backendConfig.laser_sensitivity,
          pyro_sensitivity: backendConfig.pyro_sensitivity
        }));
      })
      .catch(() => {});

    getHealth()
      .then((health) => {
        if (!active) return;
        setBackendHealth(health);
      })
      .catch(() => {
        if (!active) return;
        setBackendHealth(null);
      });

    return () => {
      active = false;
    };
  }, []);

  const singingTone = currentFrame?.is_singing ? "gold" : "white";
  const detectedTone = currentFrame?.artist_detected ? "gold" : "red";
  const singingConfidence = currentFrame?.singing_confidence ?? 0;
  const fps = currentFrame?.processing_fps ?? 0;
  const fanCount = currentFrame?.fan_count ?? 0;
  const crowdDensity = currentFrame?.crowd_density ?? 0;
  const isLive = connectionState === "live";

  /** 백엔드 MJPEG 피드 URL */
  const mjpegSrc = `${API_BASE}/api/video-feed`;

  const activeFx = useMemo(() => {
    if (!currentFrame?.fx_events) return "No FX";
    const labels = Object.entries(currentFrame.fx_events)
      .filter(([, active]) => Boolean(active))
      .map(([key]) => key.toUpperCase());
    return labels.length > 0 ? labels.join(" / ") : "No FX";
  }, [currentFrame?.fx_events]);

  function syncBrowserUrl(nextUrl: string) {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (nextUrl) {
      params.set("url", nextUrl);
    } else {
      params.delete("url");
    }
    const nextQuery = params.toString();
    const nextHref = nextQuery
      ? `${window.location.pathname}?${nextQuery}`
      : window.location.pathname;
    window.history.replaceState({}, "", nextHref);
  }

  function applyStreamUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextUrl = draftStreamUrl.trim();
    setStreamSourceUrl(nextUrl);
    syncBrowserUrl(nextUrl);
  }

  return (
    <main className="min-h-screen px-4 py-6 text-white md:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">

        {/* ── 헤더 + URL 입력 + 상태 뱃지 ─────────────────────── */}
        <section className="mb-6 flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/[0.03] px-6 py-6 shadow-stage backdrop-blur md:flex-row md:items-end md:justify-between">
          <div className="max-w-4xl">
            <p className="text-sm uppercase tracking-[0.42em] text-gold-200/80">
              Park Hyo Shin Stage Console
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
              SoulTree Vision / Analysis
            </h1>
            <p className="mt-4 text-sm leading-7 text-white/60 md:text-base">
              스켈레톤 오버레이, SSE 실시간 스트림, Singing Voice 효과, FX 타임라인,
              응원봉 팬 감지, threshold 제어를 한 화면에서 확인하는 공연 분석 대시보드입니다.
            </p>

            <form
              onSubmit={applyStreamUrl}
              className="mt-5 flex flex-col gap-3 rounded-[1.5rem] border border-white/10 bg-black/25 p-4 md:flex-row md:items-center"
            >
              <div className="flex-1">
                <label
                  htmlFor="stream-url"
                  className="mb-2 block text-xs uppercase tracking-[0.28em] text-white/45"
                >
                  YouTube Stream URL
                </label>
                <input
                  id="stream-url"
                  type="url"
                  value={draftStreamUrl}
                  onChange={(event) => setDraftStreamUrl(event.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-gold-300/40 focus:bg-white/[0.08]"
                />
              </div>
              <div className="flex gap-2 md:self-end">
                <button
                  type="submit"
                  className="rounded-2xl border border-gold-300/40 bg-gold-300/15 px-5 py-3 text-sm font-medium text-gold-100 transition hover:bg-gold-300/20"
                >
                  Apply Stream
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraftStreamUrl("");
                    setStreamSourceUrl("");
                    syncBrowserUrl("");
                  }}
                  className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/10"
                >
                  Clear
                </button>
              </div>
            </form>
          </div>

          {/* 상태 뱃지 5개 (Fan Count 추가) */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <StatusBadge
              label="Artist"
              value={currentFrame?.artist_detected ? "Detected" : "Searching"}
              tone={detectedTone}
            />
            <StatusBadge
              label="Singing"
              value={currentFrame?.is_singing ? "Voice Active" : "Standby"}
              tone={singingTone}
            />
            <StatusBadge
              label="FX"
              value={activeFx}
              tone={activeFx === "No FX" ? "white" : "gold"}
            />
            <StatusBadge
              label="FPS"
              value={fps > 0 ? `${fps.toFixed(1)} fps` : "Awaiting"}
              tone="white"
            />
            <StatusBadge
              label="응원봉"
              value={isLive ? `${formatFanCount(fanCount)} 개` : "—"}
              tone={fanCount > 0 ? "gold" : "white"}
            />
          </div>
        </section>

        {/* ── 메인 그리드 ──────────────────────────────────────── */}
        <section className="grid gap-6 xl:grid-cols-[1.5fr_0.7fr]">

          {/* 왼쪽: 영상 + 타임라인 */}
          <div className="space-y-6">
            <NeonCard className="overflow-hidden p-4 md:p-5">
              {/* 실제 분석 영상 (MJPEG) + 스켈레톤 캔버스 */}
              <VideoCanvasOverlay
                frame={currentFrame}
                showSkeleton={config.showSkeleton}
                mjpegSrc={mjpegSrc}
                videoSrc={process.env.NEXT_PUBLIC_ANALYSIS_VIDEO_URL}
                isLive={isLive}
              />

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/45">
                    Timestamp
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-gold-100">
                    {currentFrame?.timestamp ?? "--:--.-"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/45">
                    Singing Confidence
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {(singingConfidence * 100).toFixed(0)}%
                  </p>
                </div>

                {/* 팬(응원봉) 카운터 카드 */}
                <div className="rounded-2xl border border-gold-300/20 bg-gold-300/5 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-gold-200/60">
                    응원봉 감지
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-gold-100">
                    {isLive ? formatFanCount(fanCount) : "—"}
                  </p>
                  {/* 밀도 바 */}
                  {isLive && (
                    <div className="mt-2 flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                            i < densityBars(crowdDensity)
                              ? "bg-gold-300"
                              : "bg-white/10"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/45">
                    Stream State
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {formatConnectionLabel(connectionState)}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-white/45 break-all">
                    {streamSourceUrl || "소스 URL이 없어 현재는 백엔드 idle 모드입니다."}
                  </p>
                </div>
              </div>
            </NeonCard>

            <NeonCard>
              <EventTimeline events={timeline} />
            </NeonCard>
          </div>

          {/* 오른쪽: 컨트롤 + 진단 */}
          <div className="space-y-6">
            <NeonCard>
              <ControlPanel
                config={config}
                onConfigChange={setConfig}
                onSkeletonToggle={(showSkeleton) =>
                  setConfig((current) => ({ ...current, showSkeleton }))
                }
                confidenceScore={currentFrame?.confidence_score ?? 0}
                connectionLabel={formatConnectionLabel(connectionState)}
              />
            </NeonCard>

            {/* 팬 감지 상세 카드 */}
            <NeonCard className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/45">
                  Crowd Detection
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  Fan Counter
                </h2>
              </div>

              <div className="grid gap-3">
                {/* 응원봉 숫자 대형 표시 */}
                <div className="flex items-center justify-between rounded-2xl border border-gold-300/20 bg-gradient-to-br from-gold-300/10 to-transparent p-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-gold-200/60">
                      응원봉 / Glowsticks
                    </p>
                    <p className="mt-1 text-5xl font-bold tabular-nums text-gold-100">
                      {isLive ? formatFanCount(fanCount) : "—"}
                    </p>
                  </div>
                  {/* 아이콘 */}
                  <div className="text-5xl select-none opacity-60">🪄</div>
                </div>

                {/* 군중 밀도 게이지 */}
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/45">
                      Crowd Density
                    </p>
                    <p className="text-sm font-semibold text-white/70">
                      {isLive ? `${(crowdDensity * 100).toFixed(0)}%` : "—"}
                    </p>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-gold-300/60 to-gold-100 transition-all duration-500"
                      style={{ width: isLive ? `${crowdDensity * 100}%` : "0%" }}
                    />
                  </div>
                </div>

                {/* 설명 */}
                <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <p className="text-xs leading-6 text-white/40">
                    관객석 하단 영역에서 HSV 고밝기·고채도 블롭을 감지합니다.
                    콘서트 조명 아래 응원봉 하나가 곧 팬 한 명입니다.
                  </p>
                </div>
              </div>
            </NeonCard>

            {/* 기존 진단 카드 */}
            <NeonCard className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/45">
                  Stream Diagnostics
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  Live Payload Summary
                </h2>
              </div>
              <div className="grid gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/45">
                    Confidence Badge
                  </p>
                  <div className="mt-3 inline-flex rounded-full border border-gold-300/40 bg-gold-300/10 px-4 py-2 text-sm font-medium text-gold-100">
                    {(currentFrame?.confidence_score ?? 0).toFixed(2)}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/45">
                    Landmarks
                  </p>
                  <p className="mt-2 text-lg font-medium text-white">
                    {currentFrame?.pose_landmarks?.length ?? 0} points
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/45">
                    Pose Engine
                  </p>
                  <p className="mt-2 text-lg font-medium text-white">
                    {backendHealth?.pose_engine.ready ? "Ready" : "Model Required"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-white/65">
                    {backendHealth?.pose_engine.reason ??
                      "백엔드 상태 정보를 아직 불러오지 못했습니다."}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/45">
                    SSE Error
                  </p>
                  <p className="mt-2 text-sm leading-6 text-white/65">
                    {lastError ?? "활성 오류가 없습니다. 스트림은 안정적입니다."}
                  </p>
                </div>
              </div>
            </NeonCard>
          </div>
        </section>
      </div>
    </main>
  );
}
