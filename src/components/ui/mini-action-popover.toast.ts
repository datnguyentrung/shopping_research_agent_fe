import { toast } from "sonner";

export function showComingSoonActionToast(
  actionLabel: string,
  itemLabel?: string,
) {
  const suffix = itemLabel ? ` (${itemLabel})` : "";
  toast.info("Chức năng đang được phát triển", {
    description: `Bạn đã chọn ${actionLabel}${suffix}. Tính năng này sẽ sớm được ra mắt trong thời gian tới!`,
    duration: 3000, // Tự động tắt sau 3 giây (3000ms)
  });
}
