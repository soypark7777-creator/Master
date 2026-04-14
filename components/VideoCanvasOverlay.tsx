"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { drawSkeleton } from "@/lib/drawSkeleton";
import { AnalysisFrame } from "@/lib/types";

type VideoCanvasOverlayProps = {
  frame: AnalysisFrame | null;
  showSkeleton: boolean;
  /** MJPEG 스트림 URL (백엔드 /api/video-feed). 설정되면 실제 분석 영상을 표시한다. */
  mjpegSrc?: string;
  /** 로컬 비디오 파일 fallback (mjpegSrc 없을 때 사용) */
  videoSrc?: string;
  /** 스트림이 활성 상태인지 – false면 placeholder 표시 */
  isLive?: boolean;
};

type CanvasViewport = {
  width: number;
  height: number;
};

export function VideoCanvasOverlay({
  frame,
  showSkeleton,
  mjpegSrc,
  videoSrc,
  isLive = false
}: VideoCanvasOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState<CanvasViewport>({
    width: 1280,
    height: 720
  });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setViewport({
        width: Math.max(1, Math.round(width)),
        height: Math.max(1, Math.round(height))
      });
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ratio = window.devicePixelRatio || 1;
    canvas.width = viewport.width * ratio;
    canvas.height = viewport.height * ratio;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawSkeleton(context, frame, viewport.width, viewport.height, { showSkeleton });
  }, [frame, showSkeleton, viewport]);

  const showMjpeg = isLive && mjpegSrc;
  const showVideo = !showMjpeg && videoSrc;

  return (
    <div
      ref={containerRef}
      className="relative aspect-video overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#070709] shadow-stage"
    >
      {/* ── 영상 레이어 ─────────────────────────────────── */}
      {showMjpeg ? (
        /* MJPEG: 백엔드가 분석하는 실제 영상 프레임을 <img>로 수신 */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mjpegSrc}
          className="h-full w-full object-contain"
          alt="Live analysis stream"
        />
      ) : showVideo ? (
        <video
          className="h-full w-full object-contain"
          src={videoSrc}
          autoPlay
          muted
          loop
          playsInline
          controls
        />
      ) : (
        /* placeholder – 스트림 대기 중 */
        <div className="flex h-full w-full items-center justify-center">
          <svg
            className="opacity-10"
            viewBox="0 0 1280 720"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
                <stop stopColor="#0b0b10" />
                <stop offset="0.6" stopColor="#121218" />
                <stop offset="1" stopColor="#050506" />
              </linearGradient>
            </defs>
            <rect width="1280" height="720" fill="url(#g)" />
            <circle cx="920" cy="140" r="170" fill="rgba(245,221,180,0.16)" />
            <circle cx="310" cy="220" r="120" fill="rgba(255,255,255,0.08)" />
          </svg>
        </div>
      )}

      {/* ── 분위기 오버레이 그라데이션 ─────────────────── */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,221,180,0.05),transparent_30%),linear-gradient(180deg,transparent,rgba(0,0,0,0.22))]" />

      {/* ── 스켈레톤 캔버스 ─────────────────────────────── */}
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" />

      {/* ── 좌상단 뱃지 ─────────────────────────────────── */}
      <div className="pointer-events-none absolute left-5 top-5 flex items-center gap-2">
        <span className="rounded-full border border-gold-200/25 bg-black/30 px-4 py-2 text-[11px] uppercase tracking-[0.32em] text-gold-100 backdrop-blur">
          {showMjpeg ? "Live Analysis Feed" : "Skeleton Overlay"}
        </span>
        {showMjpeg && (
          <span className="flex items-center gap-1.5 rounded-full border border-red-400/30 bg-red-900/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-red-300 backdrop-blur">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
            REC
          </span>
        )}
      </div>
    </div>
  );
}
