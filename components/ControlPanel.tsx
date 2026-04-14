"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import clsx from "clsx";
import { postConfig } from "@/lib/api";
import { ConfigState } from "@/lib/types";

type ControlPanelProps = {
  config: ConfigState;
  onConfigChange: (config: ConfigState) => void;
  onSkeletonToggle: (showSkeleton: boolean) => void;
  confidenceScore: number;
  connectionLabel: string;
};

type SliderProps = {
  id: keyof ConfigState;
  label: string;
  value: number;
  onChange: (next: number) => void;
};

function SliderRow({ id, label, value, onChange }: SliderProps) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.25em] text-white/55">
        <span>{label}</span>
        <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-gold-100">
          {value.toFixed(2)}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[#ebca81]"
      />
    </label>
  );
}

export function ControlPanel({
  config,
  onConfigChange,
  onSkeletonToggle,
  confidenceScore,
  connectionLabel
}: ControlPanelProps) {
  const [draft, setDraft] = useState(config);
  const [isPending, startTransition] = useTransition();
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");

  useEffect(() => {
    setDraft(config);
  }, [config]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (draft === config) {
        return;
      }

      startTransition(async () => {
        try {
          await postConfig(draft);
          onConfigChange(draft);
          setSaveState("saved");
        } catch {
          setSaveState("error");
        }
      });
    }, 180);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [config, draft, onConfigChange]);

  const scorePercent = useMemo(
    () => Math.max(0, Math.min(100, confidenceScore * 100)),
    [confidenceScore]
  );

  return (
    <div className="space-y-6">
      <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">
              Confidence Score
            </p>
            <p className="mt-2 text-3xl font-semibold text-gold-100">
              {scorePercent.toFixed(0)}%
            </p>
          </div>
          <div className="rounded-full border border-gold-300/30 bg-gold-300/10 px-3 py-2 text-xs uppercase tracking-[0.25em] text-gold-100">
            {connectionLabel}
          </div>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,0.9),rgba(235,202,129,0.95),rgba(191,127,29,0.95))] transition-[width] duration-300"
            style={{ width: `${scorePercent}%` }}
          />
        </div>
      </div>

      <div className="space-y-5 rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">Detection Thresholds</p>
            <p className="text-sm text-white/55">
              백엔드 `/api/config`와 즉시 동기화됩니다.
            </p>
          </div>
          <span
            className={clsx(
              "rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.28em]",
              saveState === "error"
                ? "border border-rose-400/30 bg-rose-500/10 text-rose-100"
                : "border border-white/10 bg-white/5 text-white/70"
            )}
          >
            {isPending ? "Syncing" : saveState === "error" ? "Retry" : "Synced"}
          </span>
        </div>

        <SliderRow
          id="min_detection_confidence"
          label="Detection"
          value={draft.min_detection_confidence}
          onChange={(next) =>
            setDraft((current) => ({ ...current, min_detection_confidence: next }))
          }
        />
        <SliderRow
          id="min_tracking_confidence"
          label="Tracking"
          value={draft.min_tracking_confidence}
          onChange={(next) =>
            setDraft((current) => ({ ...current, min_tracking_confidence: next }))
          }
        />
        <SliderRow
          id="laser_sensitivity"
          label="Laser Sensitivity"
          value={draft.laser_sensitivity}
          onChange={(next) =>
            setDraft((current) => ({ ...current, laser_sensitivity: next }))
          }
        />
        <SliderRow
          id="pyro_sensitivity"
          label="Pyro Sensitivity"
          value={draft.pyro_sensitivity}
          onChange={(next) =>
            setDraft((current) => ({ ...current, pyro_sensitivity: next }))
          }
        />

        <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <div>
            <p className="text-sm font-medium text-white">Show Skeleton</p>
            <p className="text-xs text-white/50">Canvas overlay on/off</p>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !draft.showSkeleton;
              setDraft((current) => ({
                ...current,
                showSkeleton: next
              }));
              onSkeletonToggle(next);
            }}
            className={clsx(
              "relative h-7 w-14 rounded-full transition",
              draft.showSkeleton ? "bg-gold-300/60" : "bg-white/15"
            )}
          >
            <span
              className={clsx(
                "absolute top-1 h-5 w-5 rounded-full bg-white transition",
                draft.showSkeleton ? "left-8" : "left-1"
              )}
            />
          </button>
        </label>
      </div>
    </div>
  );
}
