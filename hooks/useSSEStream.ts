"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildStreamUrl } from "@/lib/api";
import {
  AnalysisFrame,
  ConfigState,
  ConnectionState,
  EventType,
  TimelineEvent
} from "@/lib/types";

const EVENT_WINDOW_MS = 2200;

const EVENT_LABELS: Record<EventType, string> = {
  laser: "LASER DETECTED",
  pyro: "PYRO DETECTED",
  flash: "FLASH BURST"
};

type UseSSEStreamOptions = {
  config: ConfigState;
  streamSourceUrl?: string;
};

type UseSSEStreamResult = {
  currentFrame: AnalysisFrame | null;
  timeline: TimelineEvent[];
  connectionState: ConnectionState;
  lastError: string | null;
};

function toEventId(type: EventType, timestamp: string) {
  return `${type}-${timestamp}`;
}

export function useSSEStream({
  config,
  streamSourceUrl
}: UseSSEStreamOptions): UseSSEStreamResult {
  const [currentFrame, setCurrentFrame] = useState<AnalysisFrame | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const [lastError, setLastError] = useState<string | null>(null);

  const frameRef = useRef<AnalysisFrame | null>(null);
  const rafRef = useRef<number | null>(null);
  const recentEventsRef = useRef<Map<EventType, number>>(new Map());

  const streamUrl = useMemo(
    () =>
      buildStreamUrl({
        url: streamSourceUrl,
        confidence: config.min_detection_confidence,
        trackingConfidence: config.min_tracking_confidence
      }),
    [
      config.min_detection_confidence,
      config.min_tracking_confidence,
      streamSourceUrl
    ]
  );

  useEffect(() => {
    setConnectionState("connecting");
    setLastError(null);
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      setConnectionState("error");
      setLastError("This browser does not support SSE EventSource.");
      return;
    }

    let source: EventSource;
    try {
      source = new EventSource(streamUrl);
    } catch (error) {
      setConnectionState("error");
      setLastError(
        error instanceof Error
          ? error.message
          : "Failed to initialize the SSE connection."
      );
      return;
    }

    source.onopen = () => {
      setConnectionState("live");
    };

    source.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as AnalysisFrame;
        frameRef.current = parsed;
        setLastError(parsed.stream_error ?? null);

        if (rafRef.current === null) {
          rafRef.current = window.requestAnimationFrame(() => {
            rafRef.current = null;
            setCurrentFrame(frameRef.current);
          });
        }

        const eventTypes = Object.entries(parsed.fx_events ?? {})
          .filter(([, active]) => Boolean(active))
          .map(([type]) => type as EventType);

        if (eventTypes.length > 0) {
          setTimeline((previous) => {
            const next = [...previous];
            const now = Date.now();

            for (const type of eventTypes) {
              const lastSeen = recentEventsRef.current.get(type) ?? 0;
              if (now - lastSeen < EVENT_WINDOW_MS) {
                continue;
              }

              recentEventsRef.current.set(type, now);
              next.unshift({
                id: toEventId(type, parsed.timestamp),
                type,
                label: EVENT_LABELS[type],
                timestamp: parsed.timestamp,
                createdAt: now
              });
            }

            return next.sort((a, b) => b.createdAt - a.createdAt).slice(0, 40);
          });
        }
      } catch (error) {
        setConnectionState("error");
        setLastError(
          error instanceof Error ? error.message : "Invalid SSE payload"
        );
      }
    };

    source.onerror = () => {
      setConnectionState("error");
      setLastError((current) =>
        current ?? "Stream disconnected. Waiting for backend recovery."
      );
    };

    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
      source.close();
      setConnectionState("idle");
    };
  }, [streamUrl]);

  return {
    currentFrame,
    timeline,
    connectionState,
    lastError
  };
}
