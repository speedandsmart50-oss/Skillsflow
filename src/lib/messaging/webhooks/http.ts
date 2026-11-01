export const MAX_META_WEBHOOK_BODY_BYTES = 1_048_576;

export async function readBoundedMetaWebhookBody(
  request: Request,
): Promise<Uint8Array | null> {
  const contentLength = request.headers.get("content-length");
  if (
    contentLength
    && /^\d+$/.test(contentLength)
    && Number(contentLength) > MAX_META_WEBHOOK_BODY_BYTES
  ) {
    return null;
  }
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalLength += value.byteLength;
    if (totalLength > MAX_META_WEBHOOK_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}
