export function playbackRange(
  start: number | null,
  end: number | null,
  duration: number,
) {
  if (
    start === null ||
    end === null ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    !Number.isFinite(duration) ||
    start < 0 ||
    start >= end ||
    end > duration
  )
    return null;
  return {
    start: Math.max(0, start - 0.25),
    end: Math.min(duration, end + 0.25),
  };
}
