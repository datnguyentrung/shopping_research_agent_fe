export const formatDateDMY = (dateString: string | number | Date) => {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

export const formatDateDMYHM = (dateString: string | number | Date) => {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${day}/${month}/${year} - ${hours}:${minutes}`;
};

export const formatDateDM = (dateString: Date) => {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${day}-${month}`;
};

export const formatTimeHM = (dateString: string | Date) => {
  const date = new Date(dateString);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
};

export const formatTimeStringHM = (timeString: string): string => {
  // Ví dụ: timeString là "15:32:57.613"

  // 1. Tìm vị trí dấu hai chấm thứ hai (trước giây)
  const secondColonIndex = timeString.indexOf(":", timeString.indexOf(":") + 1);

  // 2. Cắt chuỗi từ đầu đến vị trí đó
  if (secondColonIndex !== -1) {
    // Trả về chuỗi "15:32"
    return timeString.substring(0, secondColonIndex);
  }

  // Trường hợp chuỗi không đúng định dạng (không có dấu hai chấm thứ hai)
  // Hoặc bạn có thể xử lý bằng cách khác tùy ý. Ở đây, tôi trả về chuỗi gốc.
  return timeString;
};

export const formatDateYMD = (dateString: Date | number) => {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${year}-${month}-${day}`;
};

export const formatDateTimeForBackend = (dateString: Date | number) => {
  const date = new Date(dateString);

  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  // Thêm giây (nếu không cần chính xác giây hiện tại thì để mặc định '00')
  const seconds = date.getSeconds().toString().padStart(2, "0");

  // SỬA LẠI: Dùng dấu 'T' ngăn cách và thêm giây
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

export const getDurationInMinutes = (startTime: string, endTime: string) => {
  if (!startTime || !endTime) return 0;

  // Tách chuỗi và lấy giờ, phút. map(Number) sẽ chuyển chuỗi thành số.
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);

  const startTotalMinutes = startHour * 60 + startMinute;
  const endTotalMinutes = endHour * 60 + endMinute;

  // Xử lý trường hợp qua đêm (nếu có)
  if (endTotalMinutes < startTotalMinutes) {
    return endTotalMinutes + 24 * 60 - startTotalMinutes;
  }

  return endTotalMinutes - startTotalMinutes;
};

export const getCurrentWeekday = () => {
  const currentJsDay = new Date().getDay(); // Trả về 0 (CN) đến 6 (Thứ 7)

  if (currentJsDay === 0) {
    return 1; // Nếu hôm nay là Chủ nhật, trả về 1 (Theo chuẩn backend: Thứ 2 = 2, ..., Chủ nhật = 1)
  }

  return currentJsDay + 1; // Các ngày khác: 1 (T2 của JS) + 1 = 2 (Thứ 2 của Backend)
};
