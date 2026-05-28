export function toOrigin(baseUrl: string): string {
  try {
    return new URL(baseUrl).origin;
  } catch {
    return baseUrl.replace(/\/$/, "");
  }
}

export function toWebSocketBaseUrl(httpBaseUrl: string): string {
  try {
    const url = new URL(httpBaseUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.toString().replace(/\/$/, "");
  } catch {
    return httpBaseUrl.replace(/^https?:/, (m) =>
      m === "https:" ? "wss:" : "ws:",
    );
  }
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(",");
  const mimeMatch = /data:(.*?);base64/.exec(meta);
  const mime = mimeMatch?.[1] ?? "application/octet-stream";
  const bytes = atob(base64);
  const array = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) array[i] = bytes.charCodeAt(i);
  return new Blob([array], { type: mime });
}

export async function urlToFile(
  url: string,
  filename: string,
): Promise<File> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch image");
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type || "image/png" });
}
