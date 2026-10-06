import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Session, Recording } from "../../src/types";

let server: ChildProcess, base: string, token: string;
let speeches: Session[], takes: Recording[];
const evidence = "docs/evidence/native-workspace";
test.beforeAll(async ({ request }) => {
  fs.mkdirSync(evidence, { recursive: true });
  server = spawn(
    path.resolve(".venv/Scripts/python.exe"),
    ["backend/server.py"],
    {
      env: {
        ...process.env,
        SPEECH_DATA_DIR: fs.mkdtempSync(
          path.join(os.tmpdir(), "speech-native-"),
        ),
        SPEECH_UI_DIR: path.resolve("dist"),
        PYTHONUTF8: "1",
      },
      windowsHide: true,
    },
  );
  const connection = await new Promise<{ port: number; token: string }>(
    (resolve, reject) => {
      let out = "";
      server.stdout!.on("data", (data) => {
        out += data;
        if (out.includes("\n"))
          resolve(JSON.parse(out.slice(0, out.indexOf("\n"))));
      });
      server.once("error", reject);
      server.once("exit", (code) =>
        reject(new Error(`Backend exited ${code}`)),
      );
    },
  );
  base = `http://127.0.0.1:${connection.port}`;
  token = connection.token;
  const headers = { Authorization: `Bearer ${token}` };
  speeches = [];
  for (const [title, text] of [
    [
      "The Power of Small Actions",
      "Good morning everyone. Today, I want to talk about the power of small actions. It is easy to think that real change only happens through big, dramatic moments — a major invention, a groundbreaking idea, or a once-in-a-lifetime opportunity. But the truth is, meaningful progress usually starts much smaller than that. Every positive change begins with a single, simple decision. A choice to show up. A decision to try. A small step, repeated over time, that builds into something remarkable. Think about learning a new skill, getting healthier, or making a difference in your community. None of these happen overnight. They happen because of small, consistent actions — the kind that might seem insignificant in the moment, but add up to extraordinary results.",
    ],
    [
      "A Voice Made in Dialogue",
      "A clear message requires careful listening. We learn through dialogue.",
    ],
  ])
    speeches.push(
      await (
        await request.post(base + "/api/sessions", {
          headers,
          data: { title, text },
        })
      ).json(),
    );
  const samples = 16000 * 8,
    wav = Buffer.alloc(44 + samples * 2);
  wav.write("RIFF");
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(16000, 24);
  wav.writeUInt32LE(32000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++)
    wav.writeInt16LE(
      Math.round(
        Math.sin((i * 440 * Math.PI * 2) / 16000) *
          Math.abs(Math.sin(i / 5000)) *
          8000,
      ),
      44 + i * 2,
    );
  // Synthetic PCM tests continuity and waveform rendering; it is not speech evidence.
  takes = [];
  for (let i = 0; i < speeches.length; i++) {
    const sentence = speeches[i].sentences![i === 0 ? 1 : 0];
    await request.post(`${base}/api/sentences/${sentence.id}/recordings`, {
      headers,
      multipart: {
        file: {
          name: "UI-TEST-synthetic.wav",
          mimeType: "audio/wav",
          buffer: wav,
        },
      },
    });
    takes.push(
      (
        await (
          await request.get(
            `${base}/api/sessions/${speeches[i].id}/recordings`,
            { headers },
          )
        ).json()
      )[0],
    );
  }
  await request.patch(`${base}/api/sessions/${speeches[0].id}/progress`, {
    headers,
    data: { sentence_id: takes[0].sentence_id },
  });
});
test.afterAll(() => server?.kill());
test.beforeEach(async ({ page, request }) => {
  // Each test restores selection because the backend persists sentence navigation.
  await request.patch(`${base}/api/sessions/${speeches[0].id}/progress`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { sentence_id: takes[0].sentence_id },
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript((id) => {
    localStorage.setItem("session", id);
    localStorage.setItem("language", "zh");
  }, speeches[0].id);
  await page.route("**/api/sessions/*/recordings", async (route) => {
    const response = await route.fetch();
    const rows = await response.json();
    await route.fulfill({
      response,
      json: rows.map((r: Recording) =>
        r.id !== takes[0].id
          ? r
          : {
              ...r,
              created_at: "2026-10-04T22:00:00+08:00",
              content_feedback: {
                transcript: {
                  text: r.spoken_text,
                  uncertain: false,
                  provider: "UI TEST / OFFLINE FIXTURE",
                },
                differences: [],
                observations: [
                  {
                    kind: "recognized_words_per_minute",
                    value: 126,
                    source: "UI TEST",
                    notice: "Offline UI fixture",
                  },
                  {
                    kind: "interword_gaps",
                    value: [
                      { start: 2, end: 3, seconds: 1 },
                      { start: -1, end: 30, seconds: 31 },
                    ],
                    source: "UI TEST",
                    notice:
                      "Offline UI fixture; includes an invalid range to test filtering",
                  },
                ],
              },
              pronunciation_feedback: {
                status: "success",
                provider: "UI TEST / OFFLINE FIXTURE",
                score: 78,
                words: [
                  {
                    word: "Today",
                    score: 90,
                    start: 0.3,
                    end: 0.8,
                    phones: [],
                  },
                  {
                    word: "power",
                    score: 64,
                    start: 1.4,
                    end: 2.1,
                    phones: [],
                  },
                  {
                    word: "actions",
                    score: null,
                    start: null,
                    end: null,
                    phones: [],
                  },
                ],
                issues: [
                  {
                    id: "fixture",
                    text: "power",
                    start: 1.4,
                    end: 2.1,
                    category: "pronunciation",
                    severity: "moderate",
                    problem: "离线界面测试反馈：需回听复核。",
                    problem_en: "Offline UI fixture; listen to review.",
                    advice: "回放片段，与示范音频对比。",
                    advice_en: "Replay and compare with the example.",
                    source: "UI TEST",
                    time_source: "fixture",
                    localization_level: "word",
                    evidence: {},
                  },
                ],
                scores: {
                  pronunciation: {
                    value: 78,
                    status: "available",
                    source: "UI TEST",
                    source_field: "fixture",
                    raw_scale: [0, 100],
                    conversion: "identity",
                  },
                },
              },
            },
      ),
    });
  });
  await page.goto(`${base}/#token=${token}`);
  await expect(page.locator(".speech-title")).toHaveText(speeches[0].title);
});

test("practice polish visual states", async ({ page, context }) => {
  const folder = `docs/evidence/practice-polish/${process.env.POLISH_PHASE || "after"}`;
  fs.mkdirSync(folder, { recursive: true });
  await page.setViewportSize({ width: 1468, height: 854 });
  await page.evaluate(() => document.fonts.ready);
  await page
    .locator(".pa-recording-track audio")
    .evaluate((el: HTMLAudioElement) => {
      el.currentTime = 3;
    });
  await page.getByRole("tab", { name: "专注", exact: true }).click();
  await expect(page.locator(".coach-score")).toContainText("78");
  await page.mouse.move(0, 0);
  await page.screenshot({ path: `${folder}/focus-result.png` });
  await page.getByRole("button", { name: "播放当前音频", exact: true }).click();
  await expect(page.locator(".playback-bar")).toHaveClass(/is-playing/);
  await page.getByRole("button", { name: "暂停当前音频", exact: true }).click();
  await page
    .getByRole("button", { name: "下一句", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("播放对象", { exact: true })).toHaveValue(
    "demo",
  );
  await expect(page.locator(".transport-waveform line")).toHaveCount(0);
  await expect(page.locator(".coach-empty-state")).toBeVisible();
  await expect(page.locator(".coach-priorities, .coach-metrics")).toHaveCount(
    0,
  );
  await page.screenshot({ path: `${folder}/focus-long.png` });
  await page
    .getByRole("button", { name: "上一句", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "上一句", exact: true })
    .first()
    .click();
  await page.screenshot({ path: `${folder}/focus-short-empty.png` });
  await page.locator(".reader-edit summary").click();
  await expect(page.getByLabel("实际朗读稿", { exact: true })).toBeVisible();
  await page.locator(".reader-edit summary").click();
  await context.grantPermissions(["microphone"], { origin: base });
  const playerBeforeRecording = await page
    .locator(".playback-bar")
    .boundingBox();
  await page.getByRole("button", { name: "开始录音", exact: true }).click();
  await expect(page.locator(".live-waveform")).toHaveAttribute(
    "data-state",
    "live",
  );
  await page.screenshot({ path: `${folder}/recording.png` });
  if (process.env.POLISH_PHASE !== "before") {
    const playerRecording = await page.locator(".playback-bar").boundingBox();
    expect(
      Math.abs(playerRecording!.height - playerBeforeRecording!.height),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(playerRecording!.y - playerBeforeRecording!.y),
    ).toBeLessThanOrEqual(1);
  }
  await page.getByRole("button", { name: "停止录音", exact: true }).click();
  await expect(page.locator(".pa-save-status")).toContainText("录音已保存");
  await page.getByRole("tab", { name: "全文", exact: true }).click();
  await page.screenshot({ path: `${folder}/script.png` });
  for (const width of [1050, 760, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole("tab", { name: "专注", exact: true }).click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `${folder}/focus-${width}.png` });
  }
});

test("priority replay follows word timestamps and analysis state prevents duplicate requests", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1468, height: 854 });
  await page.getByRole("tab", { name: "专注", exact: true }).click();
  await page.getByRole("button", { name: /回听片段/ }).click();
  await expect(page.locator(".playing-word")).toHaveText("power");
  await expect
    .poll(() =>
      page
        .locator(".pa-recording-track audio")
        .evaluate((el: HTMLAudioElement) => el.currentTime),
    )
    .toBeGreaterThanOrEqual(1.4);
  await expect
    .poll(() =>
      page
        .locator(".pa-recording-track audio")
        .evaluate((el: HTMLAudioElement) => el.paused),
    )
    .toBeTruthy();
  await expect(page.locator(".playing-word")).toHaveCount(0);
  const job = {
    id: "polish-analysis",
    action: "analyze",
    status: "running",
    stage: "recognizing",
    total: 1,
    completed: 0,
    error: null,
  };
  await page.route("**/api/events?*", (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      body: `data: ${JSON.stringify([job])}\n\n`,
    }),
  );
  await page.route(`**/api/recordings/${takes[0].id}/analyze`, (route) =>
    route.fulfill({ json: job }),
  );
  await page.reload();
  await page.getByRole("button", { name: "检查识别差异", exact: true }).click();
  await expect(page.locator(".coach-overview")).toContainText("正在分析");
  await expect(
    page.getByRole("button", { name: "检查识别差异", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "发音评测", exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: `${evidence}/../practice-polish/after/analyzing.png`,
  });
});

test("empty workspace keeps the create-speech action available", async ({
  page,
}) => {
  await page.route("**/api/sessions", (route) => route.fulfill({ json: [] }));
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "暂无稿件", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "新建演讲稿", exact: true }).last(),
  ).toBeVisible();
  await page.screenshot({
    path: `${evidence}/../practice-polish/after/empty-workspace.png`,
  });
});

test("focus, sidebar and auxiliary panel switches preserve the playing audio and live microphone", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 1586, height: 992 });
  await page.getByLabel("播放对象", { exact: true }).selectOption("own");
  await page.getByRole("button", { name: "播放当前音频", exact: true }).click();
  const audio = page.locator(".pa-recording-track audio");
  await audio.evaluate((el) => {
    (window as any).nativeAudio = el;
  });
  await expect
    .poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime))
    .toBeGreaterThan(0.1);
  await page.getByRole("tab", { name: "专注", exact: true }).click();
  await expect(page.locator(".sentence-content")).toHaveText(
    speeches[0].sentences![1].spoken_text,
  );
  await page.getByRole("button", { name: "切换辅助面板", exact: true }).click();
  await expect(page.locator(".practice-panel")).toHaveAttribute("inert", "");
  await page.getByRole("button", { name: "收起侧栏", exact: true }).click();
  expect(
    await audio.evaluate((el) => el === (window as any).nativeAudio),
  ).toBeTruthy();
  expect(await audio.evaluate((el: HTMLAudioElement) => el.paused)).toBeFalsy();
  await context.grantPermissions(["microphone"], { origin: base });
  await page.getByRole("button", { name: "重新录音", exact: true }).click();
  await expect(page.locator(".live-waveform")).toHaveAttribute(
    "data-state",
    "live",
  );
  await page.getByRole("tab", { name: "全文", exact: true }).click();
  await page.getByRole("button", { name: "切换辅助面板", exact: true }).click();
  await page.getByRole("button", { name: "展开侧栏", exact: true }).click();
  await expect(page.locator(".live-waveform")).toHaveAttribute(
    "data-state",
    "live",
  );
  await page.waitForTimeout(1100);
  await page.getByRole("button", { name: "停止录音", exact: true }).click();
  await expect(page.locator(".pa-save-status")).toContainText("录音已保存");
});

test("native pages, cross-speech record selection, weekly goal and responsive layouts", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1586, height: 992 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.locator(".audio-details > summary").click();
  await page.getByLabel("录音记录", { exact: true }).selectOption(takes[0].id);
  await page.locator(".audio-details > summary").click();
  await page.locator(".reading-scroll").evaluate((el) => {
    el.scrollTop = 0;
  });
  await expect(page.getByLabel("播放对象", { exact: true })).toHaveValue("own");
  await expect(page.locator(".transport-waveform line")).toHaveCount(180);
  await expect(page.locator(".coach-score")).toContainText("78");
  await expect(page.locator(".coach-word-score")).toHaveCount(3);
  await expect(page.locator(".coach-word-score").last()).toContainText(
    "未评分",
  );
  await expect(page.locator(".pace-reading")).toContainText("126");
  await expect(page.locator(".pause-timeline > span")).toHaveCount(1);
  await expect(page.locator(".pause-timeline > span")).toHaveAttribute(
    "style",
    /left: 25%; width: 12.5%/,
  );
  // The player shows actual samples as discrete solid-color bars, with no SVG gradient.
  await expect(page.locator(".transport-waveform linearGradient")).toHaveCount(
    0,
  );
  await page
    .locator(".pa-recording-track audio")
    .evaluate((el: HTMLAudioElement) => {
      el.currentTime = 3;
    });
  await expect
    .poll(() =>
      page
        .locator(".pa-recording-track audio")
        .evaluate((el: HTMLAudioElement) => el.currentTime),
    )
    .toBeGreaterThanOrEqual(3);
  await page.mouse.move(0, 0);
  await page.screenshot({ path: `${evidence}/practice.png` });
  await page.setViewportSize({ width: 1468, height: 854 });
  await page.screenshot({ path: `${evidence}/practice-reference.png` });
  fs.writeFileSync(
    `${evidence}/practice-geometry.json`,
    JSON.stringify(
      await page.evaluate(() =>
        Object.fromEntries(
          [
            ".speech-workspace",
            ".app-sidebar",
            ".reading-column",
            ".reading-scroll",
            ".playback-bar",
            ".practice-panel",
          ].map((selector) => {
            const r = document.querySelector(selector)!.getBoundingClientRect();
            return [
              selector,
              { x: r.x, y: r.y, width: r.width, height: r.height },
            ];
          }),
        ),
      ),
      null,
      2,
    ),
  );
  await page.getByRole("tab", { name: "专注", exact: true }).click();
  await page.screenshot({ path: `${evidence}/focus-reference.png` });
  await page.setViewportSize({ width: 1586, height: 992 });
  await page.screenshot({ path: `${evidence}/focus.png` });
  await page.locator(".main-play").hover();
  await page
    .locator(".playback-bar")
    .screenshot({ path: `${evidence}/transport-hover.png` });
  await page.mouse.down();
  await page
    .locator(".playback-bar")
    .screenshot({ path: `${evidence}/transport-pressed.png` });
  await page.mouse.move(0, 0);
  await page.mouse.up();
  await page.getByLabel("播放选项", { exact: true }).click();
  await expect(page.getByLabel("循环本句", { exact: true })).toBeVisible();
  await page.getByLabel("循环本句", { exact: true }).check();
  await page.getByLabel("循环本句", { exact: true }).uncheck();
  await page
    .locator(".playback-bar")
    .screenshot({ path: `${evidence}/transport-options.png` });
  await page.getByLabel("播放选项", { exact: true }).click();
  await page.getByRole("button", { name: "分析", exact: true }).click();
  await expect(page.locator(".word-chip")).toHaveCount(3);
  await expect(page.locator(".word-chip").last()).toBeDisabled();
  await page.screenshot({ path: `${evidence}/analysis.png` });
  await page.locator(".sentence-detail").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${evidence}/analysis-detail.png` });
  await page.getByRole("button", { name: "练习记录", exact: true }).click();
  await expect
    .poll(() => page.locator(".session-row").count())
    .toBeGreaterThanOrEqual(2);
  await page.screenshot({ path: `${evidence}/sessions.png` });
  await page
    .getByLabel("筛选稿件", { exact: true })
    .selectOption(speeches[1].id);
  await expect(page.locator(".session-row")).toHaveCount(1);
  await page.locator(".session-row").click();
  await expect(page.locator(".speech-title")).toHaveText(speeches[1].title);
  await expect(page.locator(".analysis-reference p")).toHaveText(
    takes[1].spoken_text,
  );
  await page.locator(".audio-details > summary").click();
  await expect(page.getByLabel("录音记录", { exact: true })).toHaveValue(
    takes[1].id,
  );
  await page.getByRole("button", { name: "进度", exact: true }).click();
  await expect(page.locator(".progress-metrics")).toBeVisible();
  await page.getByRole("button", { name: "设置目标", exact: true }).click();
  await page.getByLabel("每周分钟数", { exact: true }).fill("30");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.locator(".progress-ring")).toBeVisible();
  for (const width of [1586, 1366, 1050, 760, 390]) {
    await page.setViewportSize({ width, height: width === 1586 ? 992 : 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `${evidence}/progress-${width}.png` });
  }
  await page.getByRole("button", { name: "练习", exact: true }).click();
  await page.getByRole("button", { name: "切换辅助面板", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "辅助面板", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "切换辅助面板", exact: true }),
  ).toBeFocused();
  expect(errors).toEqual([]);
});

test("partial record loading is explicit and retry recovers instead of caching failure", async ({
  page,
}) => {
  let failed = true;
  await page.route(
    `**/api/sessions/${speeches[1].id}/recordings`,
    async (route) => {
      if (failed)
        await route.fulfill({
          status: 503,
          json: { detail: "UI TEST: unavailable" },
        });
      else await route.continue();
    },
  );
  await page.getByRole("button", { name: "进度", exact: true }).click();
  await expect(page.locator(".activity-warning")).toContainText(
    "仅为已加载数据",
  );
  failed = false;
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await expect(page.locator(".activity-warning")).toHaveCount(0);
  await page.getByRole("button", { name: "练习记录", exact: true }).click();
  await expect(page.locator(".sessions-list")).toContainText(speeches[0].title);
  await expect(page.locator(".sessions-list")).toContainText(speeches[1].title);
});

test("paragraph structure and unusually long sentences remain readable", async ({
  page,
  request,
}) => {
  const long =
    "When we learn to explain a complicated idea, " +
    "we compare the evidence and consider a different perspective, ".repeat(6) +
    "and then revise our explanation.";
  const response = await request.post(`${base}/api/sessions`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: "Paragraph and long sentence verification",
      text: `Hello. Thank you.\n\n${long}`,
    },
  });
  const speech = await response.json();
  await page.addInitScript((id) => {
    localStorage.setItem("session", id);
    localStorage.setItem("speech-reader-mode", "script");
  }, speech.id);
  await page.reload();
  await expect(page.locator(".speech-title")).toHaveText(speech.title);
  await expect(page.locator(".paragraph-start")).toHaveCount(1);
  await page.locator(".paragraph-start").click();
  await page.getByRole("tab", { name: "专注", exact: true }).click();
  await expect(page.locator(".sentence-content")).toHaveText(long);
  for (const width of [1468, 390]) {
    await page.setViewportSize({ width, height: width === 1468 ? 854 : 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: `docs/evidence/practice-polish/after/extreme-long-${width}.png`,
    });
  }
});
