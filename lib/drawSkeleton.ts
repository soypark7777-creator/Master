import { AnalysisFrame, Landmark } from "@/lib/types";

const CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10], [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [11, 23], [12, 24],
  [23, 24], [23, 25], [24, 26], [25, 27], [26, 28], [27, 29], [28, 30],
  [29, 31], [30, 32]
];

type DrawOptions = {
  showSkeleton: boolean;
};

function projectPoint(
  landmark: Landmark,
  canvasWidth: number,
  canvasHeight: number
) {
  return {
    x: landmark.x * canvasWidth,
    y: landmark.y * canvasHeight
  };
}

export function drawSkeleton(
  context: CanvasRenderingContext2D,
  frame: AnalysisFrame | null,
  canvasWidth: number,
  canvasHeight: number,
  options: DrawOptions
) {
  context.clearRect(0, 0, canvasWidth, canvasHeight);

  if (!frame || !frame.artist_detected) {
    return;
  }

  const landmarks = frame.pose_landmarks ?? [];

  if (options.showSkeleton && landmarks.length > 0) {
    context.save();
    context.lineWidth = 2;
    context.strokeStyle = "rgba(255, 248, 220, 0.78)";
    context.shadowBlur = 18;
    context.shadowColor = "rgba(245, 221, 180, 0.75)";
    context.beginPath();

    for (const [startIndex, endIndex] of CONNECTIONS) {
      const start = landmarks[startIndex];
      const end = landmarks[endIndex];

      if (!start || !end) {
        continue;
      }

      if ((start.visibility ?? 1) < 0.2 || (end.visibility ?? 1) < 0.2) {
        continue;
      }

      const a = projectPoint(start, canvasWidth, canvasHeight);
      const b = projectPoint(end, canvasWidth, canvasHeight);

      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
    }

    context.stroke();
    context.restore();

    context.save();
    for (const landmark of landmarks) {
      if ((landmark.visibility ?? 1) < 0.2) {
        continue;
      }

      const { x, y } = projectPoint(landmark, canvasWidth, canvasHeight);
      context.beginPath();
      context.fillStyle = "rgba(255, 255, 255, 0.95)";
      context.shadowBlur = 14;
      context.shadowColor = "rgba(217, 164, 65, 0.95)";
      context.arc(x, y, 3.2, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  if (frame.is_singing && frame.face_box) {
    const scaleX = frame.frame_size?.width
      ? canvasWidth / frame.frame_size.width
      : 1;
    const scaleY = frame.frame_size?.height
      ? canvasHeight / frame.frame_size.height
      : 1;
    const x = frame.face_box.x * scaleX;
    const y = frame.face_box.y * scaleY;
    const w = frame.face_box.w * scaleX;
    const h = frame.face_box.h * scaleY;
    const glow = context.createRadialGradient(
      x + w / 2,
      y + h / 2,
      Math.min(w, h) * 0.18,
      x + w / 2,
      y + h / 2,
      Math.max(w, h) * 0.8
    );

    glow.addColorStop(0, "rgba(255,255,255,0.24)");
    glow.addColorStop(0.45, "rgba(245,221,180,0.26)");
    glow.addColorStop(1, "rgba(245,221,180,0)");

    context.save();
    context.fillStyle = glow;
    context.beginPath();
    context.ellipse(x + w / 2, y + h / 2, w * 0.72, h * 0.82, 0, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = "rgba(255, 246, 213, 0.86)";
    context.lineWidth = 2;
    context.shadowBlur = 18;
    context.shadowColor = "rgba(217, 164, 65, 0.9)";
    context.strokeRect(x, y, w, h);
    context.restore();

    const mouth = landmarks[9] && landmarks[10]
      ? {
          x: ((landmarks[9].x + landmarks[10].x) / 2) * canvasWidth,
          y: ((landmarks[9].y + landmarks[10].y) / 2) * canvasHeight
        }
      : {
          x: x + w / 2,
          y: y + h * 0.66
        };

    context.save();
    context.strokeStyle = "rgba(255,255,255,0.9)";
    context.lineWidth = 1.5;
    context.shadowBlur = 24;
    context.shadowColor = "rgba(245, 221, 180, 0.95)";

    for (let ring = 0; ring < 3; ring += 1) {
      context.beginPath();
      context.arc(mouth.x, mouth.y, 12 + ring * 9, -0.4, Math.PI + 0.4);
      context.stroke();
    }
    context.restore();
  }
}
