import { toast } from "sonner";

const DEFAULT_TOAST_DURATION = 4000;

export const showInfoToast = (
  message: string,
  duration = DEFAULT_TOAST_DURATION,
) => {
  toast.info(message, { duration });
};

export const showWarningToast = (
  message: string,
  duration = DEFAULT_TOAST_DURATION,
) => {
  toast.warning(message, { duration });
};

export const showErrorToast = (
  message: string,
  duration = DEFAULT_TOAST_DURATION,
) => {
  toast.error(message, { duration });
};

export const showSuccessToast = (
  message: string,
  duration = DEFAULT_TOAST_DURATION,
) => {
  toast.success(message, { duration });
};
