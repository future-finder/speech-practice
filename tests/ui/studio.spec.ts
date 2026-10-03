import { test, expect } from "@playwright/test";
import { spawn, ChildProcess } from "node:child_process";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
let server: ChildProcess;
let base: string;
let token: string;
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});
test.beforeAll(async () => {
  fs.mkdirSync("docs/evidence/ui-copy", { recursive: true });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "speech-ui-"));
  server = spawn(
    path.resolve(".venv/Scripts/python.exe"),
    ["backend/server.py"],
    {
      env: {
        ...process.env,
        SPEECH_DATA_DIR: root,
        SPEECH_UI_DIR: path.resolve("dist"),
        PYTHONUTF8: "1",
      },
    },
  );
  const connection = await new Promise<{ port: number; token: string }>(
    (resolve, reject) => {
      let buffer = "";
      server.stdout!.on("data", (data) => {
        buffer += data;
        const end = buffer.indexOf("\n");
        if (end >= 0) resolve(JSON.parse(buffer.slice(0, end)));
      });
      server.once("error", reject);
      server.once("exit", (code) => reject(new Error(`Server exit: ${code}`)));
    },
  );
  base = `http://127.0.0.1:${connection.port}`;
  token = connection.token;
});
test.afterAll(() => server?.kill());

test("real backend: library, editor, microphone capture, history and bilingual settings", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["microphone"], { origin: base });
  const consoleErrors: string[] = [];
  page.on("pageerror", (e) => consoleErrors.push(e.message));
  await page.goto(`${base}/#token=${token}`);
  await page.evaluate(() => localStorage.setItem("language", "en"));
  await page.reload();
  await page.screenshot({
    path: "docs/evidence/ui-copy/welcome-en.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "中文", exact: true }).click();
  await page.screenshot({
    path: "docs/evidence/ui-copy/welcome-zh.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await page
    .locator(".welcome")
    .getByRole("button", { name: "New speech", exact: true })
    .click();
  await page.getByLabel("Title", { exact: true }).fill("A clearer voice");
  await page.screenshot({
    path: "docs/evidence/ui-copy/new-speech-en.png",
    fullPage: true,
  });
  await page
    .getByLabel("English speech", { exact: true })
    .fill(
      "Every meaningful change begins with a small decision. We choose to listen carefully.",
    );
  await page
    .getByRole("button", { name: "Create practice", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A clearer voice" }),
  ).toBeVisible();
  await page
    .getByText("Edit spoken text & sentence breaks", { exact: false })
    .click();
  await page
    .getByLabel("Spoken text", { exact: true })
    .fill("Every change begins with a decision.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator("blockquote")).toHaveText(
    "Every change begins with a decision.",
  );
  await page
    .getByRole("button", { name: /Start recording|Record again/ })
    .click();
  await page.waitForTimeout(1500);
  await page
    .getByRole("button", { name: "Stop recording", exact: true })
    .click();
  await expect(
    page.getByText("Recording saved.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".snapshot p")).toHaveText(
    "Every change begins with a decision.",
  );
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download recording" }).click();
  const file = await (await download).path();
  expect(fs.readFileSync(file!).subarray(0, 4).toString()).toBe("RIFF");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "docs/evidence/studio.png", fullPage: true });
  await page.setViewportSize({ width: 1050, height: 700 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(1050);
  await page.screenshot({
    path: "docs/evidence/ui-copy/studio-minimum.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1400, height: 960 });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "A clearer voice" }),
  ).toBeVisible();
  await expect(page.locator(".snapshot p")).toHaveText(
    "Every change begins with a decision.",
  );
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Models & settings" }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByLabel("Recognition provider"),
  ).toBeVisible();
  await expect(
    page.getByText("Not configured", { exact: true }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).last().click();
  await page.getByRole("button", { name: "中文", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "重新录音", exact: true }),
  ).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("microphone permission denied leaves the studio usable", async ({
  page,
  context,
  request,
}) => {
  await request.post(`${base}/api/sessions`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: "Permission test", text: "Practice one sentence." },
  });
  await context.clearPermissions();
  await page.goto(`${base}/#token=${token}`);
  await page.evaluate(() => {
    localStorage.setItem("language", "en");
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: () =>
        Promise.reject(
          new DOMException("Permission denied", "NotAllowedError"),
        ),
    });
  });
  await page.reload();
  await page.evaluate(() =>
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: () =>
        Promise.reject(
          new DOMException("Permission denied", "NotAllowedError"),
        ),
    }),
  );
  await page
    .getByRole("button", { name: /Start recording|Record again/ })
    .click();
  await expect(page.getByRole("alert")).toContainText("Permission denied");
  await expect(
    page.getByRole("button", { name: /Start recording|Record again/ }),
  ).toBeEnabled();
  await page.screenshot({
    path: "docs/evidence/ui-copy/permission-error.png",
    fullPage: true,
  });
});

test("synthetic provider evidence: context replay, consecutive clicks, recording switch and historical source", async ({
  page,
  request,
}) => {
  const auth = { Authorization: `Bearer ${token}` };
  const session = await (
    await request.post(`${base}/api/sessions`, {
      headers: auth,
      data: { title: "Evidence replay test", text: "Very very curious." },
    })
  ).json();
  const records = [];
  for (let i = 0; i < 2; i++)
    records.push(
      await (
        await request.post(
          `${base}/api/sentences/${session.sentences[0].id}/recordings`,
          {
            headers: auth,
            multipart: {
              file: {
                name: "virtual.wav",
                mimeType: "audio/wav",
                buffer: fs.readFileSync("docs/evidence/kokoro-af_sarah-0.wav"),
              },
            },
          },
        )
      ).json(),
    );
  const feedback = {
    schema_version: 2,
    status: "success",
    id: "synthetic",
    provider: "tencent",
    provider_version: "OFFLINE TEST FIXTURE",
    score: 55,
    overall_score: 55,
    words: [],
    scores: {
      pronunciation: {
        value: 55,
        status: "available",
        source: "tencent",
        source_field: "PronAccuracy",
        raw_scale: [0, 100],
        conversion: "identity",
      },
      five_dimension_overall: {
        value: null,
        status: "unavailable",
        source: "application",
        source_field: null,
        raw_scale: [0, 100],
        conversion: "identity",
        reason: "No method",
      },
    },
    issues: [0.1, 1].map((start, i) => ({
      id: `issue-${i}`,
      start,
      end: start + 0.3,
      text: `very #${i + 1}`,
      category: "pronunciation",
      severity: i ? "moderate" : "major",
      problem: "需复核",
      problem_en: "Review this occurrence",
      advice: "跟读回听",
      advice_en: "Shadow and replay",
      source: "tencent",
      time_source: "provider ms",
      localization_level: "phoneme",
      evidence: { word_index: i },
    })),
    raw_provider_result: { fixture: true },
  };
  await page.route("**/api/sessions/*/recordings", async (route) => {
    const response = await route.fetch();
    const rows = await response.json();
    await route.fulfill({
      response,
      json: rows.map((r: Record<string, unknown>) => ({
        ...r,
        pronunciation_feedback: feedback,
        assessment_history: [
          { ...feedback, id: "older", created_at: "2026-01-01" },
        ],
      })),
    });
  });
  await page.goto(`${base}/#token=${token}`);
  await page.evaluate(() => localStorage.setItem("language", "en"));
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Evidence replay test" }),
  ).toBeVisible();
  await expect(page.locator(".score-card").last()).toContainText("—");
  const audio = page.locator("audio").last();
  await page.locator(".issue-list button").first().click();
  await expect
    .poll(() => audio.evaluate((e: HTMLAudioElement) => e.currentTime))
    .toBeLessThan(0.95);
  await page.locator(".issue-list button").last().click();
  await expect
    .poll(() => audio.evaluate((e: HTMLAudioElement) => e.currentTime))
    .toBeGreaterThanOrEqual(0.75);
  await expect
    .poll(() => audio.evaluate((e: HTMLAudioElement) => e.paused))
    .toBeTruthy();
  await page.locator(".assessment-panel select").selectOption("older");
  await expect(page.locator(".assessment-panel")).toContainText(
    "OFFLINE TEST FIXTURE",
  );
  // Switching the history recording clears the previous fragment stop state.
  const historySelect = page.locator(".history-selector select");
  await historySelect.selectOption(records[0].id);
  await expect(historySelect).toHaveValue(records[0].id);
  await audio.evaluate((e: HTMLAudioElement) => {
    e.currentTime = 0;
    e.dispatchEvent(new PointerEvent("pointerdown"));
    return e.play();
  });
  await expect
    .poll(() => audio.evaluate((e: HTMLAudioElement) => e.currentTime))
    .toBeGreaterThan(1.7);
  await audio.evaluate((e: HTMLAudioElement) => e.pause());
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "docs/evidence/ui-copy/assessment-en.png",
    fullPage: true,
  });
});

test("optional models explain choices and preserve supported settings", async ({
  page,
  request,
}) => {
  const created = await request.post(`${base}/api/sessions`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: "Optional model choices", text: "Practice one sentence." },
  });
  const session = await created.json();
  expect(created.ok()).toBeTruthy();
  await page.addInitScript((id) => {
    localStorage.setItem("language", "en");
    localStorage.setItem("session", id);
  }, session.id);
  await page.goto(`${base}/#token=${token}`);
  await expect(
    page.getByRole("heading", { name: "Optional model choices", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Voice model", { exact: true }).selectOption("qwen");
  await expect(page.getByLabel("Delivery", { exact: true })).toBeVisible();
  await page
    .getByLabel("Delivery", { exact: true })
    .selectOption({ label: "Confident speech" });
  await page
    .getByLabel("Voice model", { exact: true })
    .selectOption("qwen-small");
  await expect(page.getByLabel("Delivery", { exact: true })).toHaveCount(0);
  await expect(page.locator("#tts-model-description")).toContainText(
    "without delivery instructions",
  );
  await page.getByLabel("Speaker", { exact: true }).selectOption("Aiden");
  await page
    .getByRole("button", {
      name: "Apply voice settings to whole speech",
      exact: true,
    })
    .click();
  await expect(page.getByRole("status")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Voice model", { exact: true })).toHaveValue(
    "qwen-small",
  );
  await expect(page.getByLabel("Speaker", { exact: true })).toHaveValue(
    "Aiden",
  );
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Local device", { exact: true }).selectOption("cuda");
  await expect(dialog.getByLabel("Local device", { exact: true })).toHaveValue(
    "cuda",
  );
  await dialog
    .getByLabel("Local ASR model", { exact: true })
    .selectOption("parakeet");
  await expect(dialog.getByLabel("Local device", { exact: true })).toHaveValue(
    "cpu",
  );
  await expect(
    dialog.getByLabel("Local device", { exact: true }),
  ).toBeDisabled();
  await expect(dialog.locator("#asr-model-description")).toContainText(
    "without using GPU memory",
  );
  await expect(
    dialog
      .locator(".models article")
      .filter({ hasText: "Qwen3-TTS 0.6B / NVIDIA" }),
  ).toContainText("smaller download");
  await page.screenshot({
    path: "docs/evidence/optional-models/settings-en.png",
    fullPage: true,
  });
  await dialog.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await page.screenshot({
    path: "docs/evidence/ui-copy/settings-bottom-en.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close", exact: true }).last().click();
  await page.getByRole("button", { name: "中文", exact: true }).click();
  await expect(page.locator("#tts-model-description")).toContainText(
    "不支持语气指令",
  );
  await page.screenshot({
    path: "docs/evidence/optional-models/studio-zh.png",
    fullPage: true,
  });
});
