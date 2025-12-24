export function validateAndNormalizeTrackId(
  body: unknown
): { success: true; trackId: number } | { success: false; error: string; status: number } {
  if (!body || typeof body !== 'object' || !('track_id' in body)) {
    return { success: false, error: 'track_id is required', status: 400 };
  }

  const { track_id } = body as { track_id: unknown };

  // 数値または数値文字列のみ許可
  const num = typeof track_id === 'number' ? track_id : Number(track_id);
  
  if (Number.isNaN(num) || !Number.isSafeInteger(num) || num <= 0) {
    return { success: false, error: 'track_id must be a valid positive integer', status: 400 };
  }

  return { success: true, trackId: num };
}
