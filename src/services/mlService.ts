import { axiosMlInstance } from "./axiosInstance";

// ML service — dùng axiosMlInstance (VITE_API_BACKEND_ML_URL = http://localhost:8001)
// Thêm các API call tới ML backend tại đây

// Kết quả tách vùng quần áo: label (vd "shirt") -> data URL PNG nền trong suốt.
export interface SegmentClothingResult {
  masks: Record<string, string>;
  notFound: string[];
}

// Tách vùng quần áo khỏi ảnh nguồn bằng Grounding DINO + SAM 2.
// `prompts` gửi dạng JSON string (Form field) theo API mới của BE.
// Trả về từng mask RGBA (PNG) dạng data URL, kèm danh sách label không tìm thấy.
//
// Endpoint: POST /grounded-segment-anything/  (ML backend port 8001)
// Form: file=<image>, prompts='["shirt","trousers",...]'
// Response: { success, masks: { label: base64 }, media_type, not_found: [label] }
export async function segmentClothing(
  file: File,
  prompts: string[],
): Promise<SegmentClothingResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("prompts", JSON.stringify(prompts));

  const response = await axiosMlInstance.post(
    "/grounded-segment-anything/",
    form,
  );
  const data = response.data as {
    success?: boolean;
    masks?: Record<string, string>;
    not_found?: string[];
    error?: string;
  };

  if (!data.success) {
    throw new Error(data.error ?? "Không thể tách vùng trang phục.");
  }

  const rawMasks = data.masks ?? {};
  // Prefix base64 thành data URL để tiện nạp vào <img>/createImageBitmap.
  const masks: Record<string, string> = {};
  for (const [label, base64] of Object.entries(rawMasks)) {
    if (typeof base64 !== "string" || base64.length === 0) continue;
    masks[label] = base64.startsWith("data:")
      ? base64
      : `data:image/png;base64,${base64}`;
  }

  return {
    masks,
    notFound: data.not_found ?? [],
  };
}
