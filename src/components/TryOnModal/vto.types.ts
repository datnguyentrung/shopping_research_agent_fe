export const PRESET_MODELS = [
  {
    id: "m1",
    src: "/vto-personas/dat1.jpg",
    label: "Mẫu Á Châu",
  },
  {
    id: "m2",
    src: "/vto-personas/dat2.jpg",
    label: "Mẫu Châu Âu",
  },
  {
    id: "m3",
    src: "/vto-personas/dat3.jpg",
    label: "Mẫu Da Màu",
  },
] as const;

export type VtoStatus =
  | "idle"
  | "validating"
  | "uploading"
  | "pending"
  | "completed"
  | "error";

export type PersonSource =
  | { kind: "persona"; src: string; label: string }
  | { kind: "user"; src: string; label: string };

export type VtoWsMessage = {
  status?: string;
  result_url?: string;
  error?: string | null;
};

export const LOCALSTORAGE_KEY = "but_user_photo";
