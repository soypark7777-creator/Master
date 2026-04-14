import { BackendHealth, ConfigState } from "@/lib/types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:5000";

export function buildStreamUrl(params?: {
  url?: string;
  confidence?: number;
  trackingConfidence?: number;
}) {
  const streamUrl = new URL("/api/stream", API_BASE);

  if (params?.url) {
    streamUrl.searchParams.set("url", params.url);
  }

  if (typeof params?.confidence === "number") {
    streamUrl.searchParams.set("confidence", String(params.confidence));
  }

  if (typeof params?.trackingConfidence === "number") {
    streamUrl.searchParams.set(
      "tracking_confidence",
      String(params.trackingConfidence)
    );
  }

  return streamUrl.toString();
}

export async function postConfig(config: ConfigState) {
  const response = await fetch(new URL("/api/config", API_BASE), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      min_detection_confidence: config.min_detection_confidence,
      min_tracking_confidence: config.min_tracking_confidence,
      laser_sensitivity: config.laser_sensitivity,
      pyro_sensitivity: config.pyro_sensitivity
    })
  });

  if (!response.ok) {
    throw new Error("Failed to update backend config");
  }

  return response.json().catch(() => null);
}

export async function getConfig() {
  const response = await fetch(new URL("/api/config", API_BASE), {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Failed to fetch backend config");
  }

  return response.json() as Promise<{
    min_detection_confidence: number;
    min_tracking_confidence: number;
    laser_sensitivity: number;
    pyro_sensitivity: number;
  }>;
}

export async function getHealth() {
  const response = await fetch(new URL("/api/health", API_BASE), {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Failed to fetch backend health");
  }

  return response.json() as Promise<BackendHealth>;
}
