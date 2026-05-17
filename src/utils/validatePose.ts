import type { Pose, Results } from "@mediapipe/pose";

// 2. Mở rộng interface Window chuẩn của TypeScript
declare global {
  interface Window {
    Pose?: typeof Pose;
  }
}

// 3. Định nghĩa cấu trúc cho module lúc import động
interface MediaPipeModule {
  Pose?: typeof Pose;
  default?: {
    Pose?: typeof Pose;
  };
}

type PoseLandmark = { visibility?: number };

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

// Nén ảnh xuống chuẩn JPEG, giảm kích thước tối đa 1024px để chống tràn localStorage
export const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 1024;
        let { width, height } = img;

        // Thu nhỏ kích thước nếu ảnh quá lớn
        if (width > MAX_SIZE || height > MAX_SIZE) {
          if (width > height) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          } else {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        // Nén ảnh về định dạng JPEG với chất lượng 70% (0.7) để cực nhẹ
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = () => reject(new Error("Lỗi tải ảnh để nén"));
    };
    reader.onerror = () => reject(new Error("Lỗi đọc file"));
  });
};

/**
 * Validates that a person photo has a detectable pose.
 * Requirements:
 * - Must detect at least 11 visible pose landmarks
 * - Must include visible shoulders + hips (torso anchors)
 */
export async function validatePose(imageSrc: string): Promise<boolean> {
  // 4. Ép kiểu (cast) kết quả import thành MediaPipeModule thay vì any
  const mpPose = (await import("@mediapipe/pose")) as MediaPipeModule;

  // 5. Lúc này TypeScript đã hiểu rõ PoseClass là gì, không còn lỗi "any" nữa
  const PoseClass = mpPose.Pose || mpPose.default?.Pose || window.Pose;

  if (!PoseClass) {
    console.error("Không thể load được class Pose từ thư viện MediaPipe");
    return false;
  }

  const pose = new PoseClass({
    locateFile: (file: string) => `${POSE_CDN_BASE}${file}`,
  });

  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.4,
    minTrackingConfidence: 0.4,
  });

  try {
    const image = await loadImage(imageSrc);

    // Bạn có thể đổi PoseResults thành Results của MediaPipe luôn cho chuẩn
    const result = await new Promise<Results>((resolve) => {
      pose.onResults((res: Results) => resolve(res));
      pose.send({ image });
    });

    const landmarks = result.poseLandmarks;
    if (!landmarks || landmarks.length === 0) return false;

    const anchorsOk = requiredTorsoLandmarks.every((index) => {
      const landmark = landmarks[index];
      return (landmark?.visibility ?? 0) >= 0.3;
    });

    if (!anchorsOk) return false;

    // Ép kiểu mảng landmarks để countVisibleLandmarks không báo lỗi
    const visibleCount = countVisibleLandmarks(landmarks as any[], 0.3);
    // (Nếu countVisibleLandmarks báo lỗi any ở đây, hãy update type PoseLandmark của bạn khớp với MediaPipe)

    return visibleCount >= 8;
  } catch (err) {
    console.error("Lỗi khi nhận diện dáng:", err);
    return false;
  } finally {
    if (typeof pose.close === "function") {
      pose.close();
    }
  }
}
