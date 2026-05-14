type PoseLandmark = { visibility?: number };

type PoseResults = {
  poseLandmarks?: PoseLandmark[];
};

const POSE_CDN_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/pose/";

const requiredTorsoLandmarks = [11, 12, 23, 24];

function countVisibleLandmarks(landmarks: PoseLandmark[], threshold: number) {
  return landmarks.reduce((count, landmark) => {
    const visibility = landmark.visibility ?? 0;
    return count + (visibility >= threshold ? 1 : 0);
  }, 0);
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = src;
  });
}

/**
 * Validates that a person photo has a detectable pose.
 * Requirements:
 * - Must detect at least 11 visible pose landmarks
 * - Must include visible shoulders + hips (torso anchors)
 */
export async function validatePose(imageSrc: string): Promise<boolean> {
  // Dynamic import keeps bundle lighter and avoids SSR pitfalls.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { Pose }: any = await import("@mediapipe/pose");

  const pose = new Pose({
    locateFile: (file: string) => `${POSE_CDN_BASE}${file}`,
  });

  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  try {
    const image = await loadImage(imageSrc);

    const result = await new Promise<PoseResults>((resolve) => {
      pose.onResults((res: PoseResults) => resolve(res));
      // MediaPipe expects an HTMLImageElement

      pose.send({ image });
    });

    const landmarks = result.poseLandmarks;
    if (!landmarks || landmarks.length === 0) return false;

    const anchorsOk = requiredTorsoLandmarks.every((index) => {
      const landmark = landmarks[index];
      return (landmark?.visibility ?? 0) >= 0.5;
    });

    if (!anchorsOk) return false;

    const visibleCount = countVisibleLandmarks(landmarks, 0.5);
    return visibleCount >= 11;
  } catch {
    return false;
  } finally {
    // `close` exists on MediaPipe solutions and releases resources.
    if (typeof pose.close === "function") {
      pose.close();
    }
  }
}
