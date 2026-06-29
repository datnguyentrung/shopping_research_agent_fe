// Lưu ảnh đã đổi màu.
// TODO: thay bằng POST thật tới backend 8000 để đẩy lên Supabase khi BE sẵn sàng.
// Hiện đang là mock: giả lập độ trễ và trả về thành công.
export async function saveRecoloredImage(
  dataUrl: string,
): Promise<{ success: boolean }> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  void dataUrl; // TODO: gửi dataUrl lên backend khi BE sẵn sàng.
  return { success: true };
}
