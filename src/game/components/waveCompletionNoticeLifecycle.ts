export const WAVE_COMPLETION_NOTICE_DURATION_MS = 3000

export function scheduleWaveCompletionNoticeDismissal(
  onDismiss: () => void,
  durationMs = WAVE_COMPLETION_NOTICE_DURATION_MS
) {
  const timeoutId = setTimeout(onDismiss, durationMs)
  return () => clearTimeout(timeoutId)
}
