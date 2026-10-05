import type { Recording, Session } from "./types";

export type ActivitySpeech = { session: Session; recordings: Recording[] };
export type ActivityData = { speeches: ActivitySpeech[]; failed: string[] };
export function localDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function practiceStats(speeches: ActivitySpeech[], now = new Date()) {
  const rows = speeches
    .flatMap((s) =>
      s.recordings.map((recording) => ({ recording, session: s.session })),
    )
    .filter((r) => Number.isFinite(Date.parse(r.recording.created_at)))
    .sort(
      (a, b) =>
        Date.parse(b.recording.created_at) - Date.parse(a.recording.created_at),
    );
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(date.getDate() + i);
    const dateKey = localDay(date);
    const takes = rows.filter(
      (r) =>
        localDay(new Date(r.recording.created_at)) === dateKey &&
        Date.parse(r.recording.created_at) <= now.getTime(),
    );
    return {
      date,
      dateKey,
      minutes:
        takes.reduce(
          (sum, r) => sum + Math.max(0, r.recording.duration || 0),
          0,
        ) / 60,
      count: takes.length,
    };
  });
  const dates = new Set(
    rows
      .filter((r) => Date.parse(r.recording.created_at) <= now.getTime())
      .map((r) => localDay(new Date(r.recording.created_at))),
  );
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!dates.has(localDay(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (dates.has(localDay(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  const completed = speeches.filter(
    ({ session, recordings }) =>
      !!session.sentences?.length &&
      session.sentences.every((s) =>
        recordings.some(
          (r) => r.sentence_id === s.id && r.sentence_version === s.version,
        ),
      ),
  ).length;
  return {
    rows,
    days,
    streak,
    completed,
    weeklyMinutes: days.reduce((s, d) => s + d.minutes, 0),
    totalMinutes:
      rows.reduce((s, r) => s + Math.max(0, r.recording.duration || 0), 0) / 60,
  };
}
export function recordingScore(record?: Recording) {
  const result = record?.pronunciation_feedback;
  if (result?.status !== "success") return null;
  const score = result.scores?.pronunciation?.value ?? result.score;
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}
export function paceObservation(record?: Recording) {
  const value = record?.content_feedback?.observations?.find(
    (o) => o.kind === "recognized_words_per_minute",
  )?.value;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
