const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((byte, index) => bytes[index] === byte);
}

export function matchesFileContentType(bytes: Uint8Array, mimeType: string): boolean {
  if (!bytes.length) return false;

  switch (mimeType) {
    case "image/jpeg":
      return bytes.length >= 3 && startsWith(bytes, [0xff, 0xd8, 0xff]);
    case "image/png":
      return bytes.length >= PNG_SIGNATURE.length && startsWith(bytes, PNG_SIGNATURE);
    case "image/webp":
      return bytes.length >= 12
        && startsWith(bytes, [0x52, 0x49, 0x46, 0x46])
        && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    case "application/pdf":
      return bytes.length >= 5 && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
    case "text/plain":
      try {
        return !bytes.includes(0) && new TextDecoder("utf-8", { fatal: true }).decode(bytes).length > 0;
      } catch {
        return false;
      }
    case "application/json":
      try {
        JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
        return true;
      } catch {
        return false;
      }
    default:
      return false;
  }
}
