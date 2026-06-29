// ─── Đổi màu HSL trên ảnh RGBA ───
// Nguyên lý: nếp gấp / độ bóng trên vải thực chất là sự khác biệt về Lightness
// giữa các pixel. Khi ta GIỮ NGUYÊN Lightness (và Saturation), chỉ thay Hue
// theo màu người dùng chọn, áo sẽ đổi sang màu mới nhưng vùng sáng/tối của nếp
// vải vẫn nằm đúng chỗ cũ → nhìn như được nhuộm màu mới.

// Chuyển đổi RGB (0-255) sang HSL. Trả về { h, s, l } đều trong khoảng [0, 1].
export function rgbToHsl(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    // Tính độ bão hòa (Saturation)
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    // Tính tông màu (Hue)
    switch (max) {
      case rn:
        h = (gn - bn) / delta + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / delta + 2;
        break;
      case bn:
        h = (rn - gn) / delta + 4;
        break;
      default:
        h = 0;
        break;
    }
    h /= 6;
  }

  return { h, s, l };
}

// Đổi màu (Hue) theo công thức HSL. h, s, l trong khoảng [0, 1].
// Trả về { r, g, b } trong khoảng [0, 255].
export function hslToRgb(
  h: number,
  s: number,
  l: number,
): { r: number; g: number; b: number } {
  if (s === 0) {
    // Xám (không bão hòa) — cả 3 kênh bằng Lightness
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const hueToRgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  return {
    r: Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hueToRgb(p, q, h) * 255),
    b: Math.round(hueToRgb(p, q, h - 1 / 3) * 255),
  };
}

export interface RecolorOptions {
  // Độ bão hòa tối thiểu (mặc định 0.42). Spec gốc giữ hoàn toàn Saturation,
  // nhưng áo sáng gần trắng sẽ có s rất thấp → màu mới không rõ.
  // Floor này ép vùng áo nhạt vẫn nhận màu rõ, đồng thời vẫn giữ L = nếp gấp.
  satFloor?: number;
  // Độ bão hòa mục tiêu từ màu người dùng chọn (0-1).
  // Khi chọn màu xám/đen (s thấp), kết quả sẽ nhạt hơn thay vì ép hue vô nghĩa.
  targetSat?: number;
}

// Tô lại màu cho imageData theo targetHue, GIỮ NGUYÊN L (độ sáng/nếp gấp).
// Chỉ đổi những pixel có kênh Alpha > 0 (vùng áo thật, bỏ nền trong suốt).
// Lưu ý: hàm này chỉnh sửa thẳng vào mảng data của imageData.
export function recolorImageData(
  imageData: ImageData,
  targetHue: number,
  options: RecolorOptions = {},
): void {
  const satFloor = options.satFloor ?? 0.42;
  const targetSat = options.targetSat;
  const pixels = imageData.data;

  // Ngưỡng achromatic: targetSat < ngưỡng này → màu xám/đen,
  // cần giảm saturation của pixel thay vì chỉ đổi hue.
  const ACHROMATIC_THRESHOLD = 0.2;

  for (let i = 0; i < pixels.length; i += 4) {
    // Chỉ đổi màu nếu kênh Alpha > 0 (vùng vải có nội dung)
    if (pixels[i + 3] > 0) {
      const { s, l } = rgbToHsl(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!);

      let finalSat: number;

      if (targetSat != null && targetSat < ACHROMATIC_THRESHOLD) {
        // Màu xám/đen: giảm saturation của pixel xuống gần target.
        // Lerp giữ lại chút variation để nếp gấp vẫn thấy.
        // Tỷ lệ: targetSat càng thấp → desaturate càng mạnh.
        const t = 1 - targetSat / ACHROMATIC_THRESHOLD; // 0 → 1
        finalSat = s * targetSat; // desaturate tỷ lệ với target
      } else if (targetSat != null) {
        finalSat = Math.max(s, targetSat);
      } else {
        finalSat = Math.max(s, satFloor);
      }

      // Giữ nguyên độ sáng (l) của nếp gấp, chỉ thay đổi Hue + Sat.
      const newRgb = hslToRgb(targetHue, finalSat, l);

      pixels[i] = newRgb.r;
      pixels[i + 1] = newRgb.g;
      pixels[i + 2] = newRgb.b;
    }
  }
}

// Trích một bản sao ImageData của một ảnh từ offscreen canvas.
// Dùng để cache dữ liệu pixel gốc của mỗi mask (chỉ đọc 1 lần).
export function imageToImageData(
  source: CanvasImageSource,
  width: number,
  height: number,
): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Không tạo được 2d context để đọc pixel");
  }
  ctx.drawImage(source, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

// Đổi một giá trị màu hex (#rrggbb) sang Hue (0-1) dùng cho bảng màu người dùng chọn.
// Trả về cả saturation để xử lý đúng màu xám/đen (hue không xác định khi s ≈ 0).
export function hexToHsl(hex: string): { h: number; s: number } {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const { h, s } = rgbToHsl(r, g, b);
  return { h, s };
}

// Giữ lại export cũ để không break code gọi hexToHue (nếu có nơi khác dùng).
export const hexToHue = (hex: string): number => hexToHsl(hex).h;
