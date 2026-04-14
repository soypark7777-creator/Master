export type Landmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

export type FaceBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type FrameSize = {
  width: number;
  height: number;
};

export type FxEvents = {
  laser?: boolean;
  pyro?: boolean;
  flash?: boolean;
};

export type FrameMetrics = {
  brightness?: number;
  contrast?: number;
  red_ratio?: number;
  green_ratio?: number;
  blue_ratio?: number;
};

export type AnalysisFrame = {
  artist_detected: boolean;
  pose_landmarks: Landmark[];
  is_singing: boolean;
  singing_confidence?: number;
  face_box?: FaceBox | null;
  frame_size?: FrameSize | null;
  fx_events: FxEvents;
  frame_metrics?: FrameMetrics;
  /** 응원봉/글로우스틱 감지 개수 (관객석 기준) */
  fan_count?: number;
  /** 관객석 발광 픽셀 밀도 0.0 – 1.0 */
  crowd_density?: number;
  confidence_score: number;
  processing_fps?: number;
  timestamp: string;
  stream_error?: string | null;
};

export type EventType = "laser" | "pyro" | "flash";

export type TimelineEvent = {
  id: string;
  type: EventType;
  label: string;
  timestamp: string;
  createdAt: number;
};

export type ConfigState = {
  min_detection_confidence: number;
  min_tracking_confidence: number;
  laser_sensitivity: number;
  pyro_sensitivity: number;
  showSkeleton: boolean;
};

export type ConnectionState = "connecting" | "live" | "error" | "idle";

export type PoseEngineHealth = {
  ready: boolean;
  backend: string;
  model_path?: string | null;
  reason?: string;
};

export type BackendHealth = {
  status: string;
  pose_engine: PoseEngineHealth;
  config: Omit<ConfigState, "showSkeleton">;
};
