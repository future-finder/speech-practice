import { test, expect } from "@playwright/test";
import {
  practiceStats,
  recordingScore,
  type ActivitySpeech,
} from "../../src/practiceData";
import type { Recording, Session } from "../../src/types";

test("practice totals use saved duration, local dates, retakes and current sentence versions", () => {
  const session = {
    id: "speech",
    sentences: [
      { id: "one", version: 2 },
      { id: "two", version: 1 },
    ],
  } as Session;
  const take = (
    id: string,
    day: number,
    sentence_id: string,
    version: number,
    duration: number,
  ): Recording => ({
    id,
    asset_id: id,
    sentence_id,
    sentence_version: version,
    spoken_text: "Test",
    duration,
    created_at: new Date(2026, 9, day, 12).toISOString(),
  });
  const recordings = [
    take("old", 1, "one", 1, 60),
    take("a", 2, "one", 2, 30),
    take("b", 3, "two", 1, 90),
    take("retake", 3, "two", 1, 60),
  ];
  const data: ActivitySpeech[] = [{ session, recordings }];
  const stats = practiceStats(data, new Date(2026, 9, 4, 12));
  expect(stats.streak).toBe(3); // Today is empty; count backwards from yesterday.
  expect(stats.completed).toBe(1);
  expect(stats.weeklyMinutes).toBe(4);
  expect(stats.totalMinutes).toBe(4);
  expect(stats.days.find((d) => d.dateKey === "2026-10-03")?.count).toBe(2);
  expect(
    practiceStats(
      [{ session, recordings: recordings.filter((r) => r.id !== "a") }],
      new Date(2026, 9, 4, 12),
    ).completed,
  ).toBe(0);
  expect(practiceStats(data, new Date(2026, 9, 5, 12)).streak).toBe(0);
  expect(practiceStats([], new Date(2026, 9, 4)).weeklyMinutes).toBe(0);
});

test("missing and failed assessments do not produce scores, while zero remains a score", () => {
  const record = {
    pronunciation_feedback: { status: "success", score: 0, words: [] },
  } as unknown as Recording;
  expect(recordingScore(record)).toBe(0);
  expect(
    recordingScore({
      ...record,
      pronunciation_feedback: {
        ...record.pronunciation_feedback!,
        status: "failed",
        score: 87,
      },
    }),
  ).toBeNull();
  expect(recordingScore(undefined)).toBeNull();
});
