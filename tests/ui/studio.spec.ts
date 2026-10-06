import { test, expect, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

let server: ChildProcess,
  base: string,
  token: string,
  session: any,
  reference: string;
const evidence = "docs/evidence/frontend-redesign";
const script = `Good afternoon, everyone, today I want to talk about something that has shaped me deeply during my university years — the power of dialogue.
We often think of a voice as something we find on our own, a clear and independent expression of who we are, but my experience has been different: my voice was not built in isolation; it was made in dialogue.
I have learned that meaningful conversations — with classmates, with teachers, and with people from different backgrounds — challenge my assumptions and help me see the world more clearly.
Dialogue is not always easy, it asks us to be curious, to be patient, and sometimes to sit with discomfort, but it is in those moments, when we truly listen and respond with openness, that real growth happens.
As we move forward, I hope we can create more spaces for honest and respectful dialogue — on campus, in our communities, and in the wider world — because a stronger, kinder, and more creative future depends on our ability to talk with, rather than past, one another.
Thank you for listening.`;
test.beforeAll(async ({ request }) => {
  fs.mkdirSync(evidence, { recursive: true });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "speech-redesign-"));
  fs.writeFileSync(
    path.join(root, "settings.json"),
    JSON.stringify({
      model_dir: path.join(
        process.env.LOCALAPPDATA!,
        "speech-practice",
        "models",
      ),
    }),
  );
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
      windowsHide: true,
    },
  );
  const connection = await new Promise<{ port: number; token: string }>(
    (resolve, reject) => {
      let buffer = "";
      server.stdout!.on("data", (chunk) => {
        buffer += chunk;
        if (buffer.includes("\n"))
          resolve(JSON.parse(buffer.slice(0, buffer.indexOf("\n"))));
      });
      server.once("error", reject);
      server.once("exit", (code) =>
        reject(new Error(`Backend exited ${code}`)),
      );
    },
  );
  base = `http://127.0.0.1:${connection.port}`;
  token = connection.token;
  const auth = { Authorization: `Bearer ${token}` };
  for (const title of [
    "The Power of Small Actions",
    "Learning Beyond the Classroom",
    "A More Open World",
    "The Courage to Be Uncertain",
    "Technology and a Kinder Society",
  ])
    await request.post(`${base}/api/sessions`, {
      headers: auth,
      data: {
        title,
        text: "We learn by listening. Practice helps us explain an idea clearly.",
      },
    });
  session = await (
    await request.post(`${base}/api/sessions`, {
      headers: auth,
      data: { title: "A Voice Made in Dialogue", text: script },
    })
  ).json();
  const job = await (
    await request.post(`${base}/api/sessions/${session.id}/generate`, {
      headers: auth,
      data: { sentence_id: session.sentences[1].id },
    })
  ).json();
  await expect
    .poll(
      async () =>
        (
          await (
            await request.get(`${base}/api/jobs/${job.id}`, { headers: auth })
          ).json()
        ).status,
      { timeout: 110000, intervals: [1000] },
    )
    .toBe("completed");
  session = await (
    await request.get(`${base}/api/sessions/${session.id}`, { headers: auth })
  ).json();
  reference = session.sentences[1].asset_id;
});
test.afterAll(() => server?.kill());
test.beforeEach(async ({ page, request }) => {
  await request.patch(`${base}/api/sessions/${session.id}/progress`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { sentence_id: session.sentences[1].id },
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript((id) => {
    localStorage.setItem("language", "zh");
    localStorage.setItem("session", id);
  }, session.id);
});
async function open(page: Page, query = "") {
  await page.goto(`${base}/${query}#token=${token}`);
  await expect(page.locator(".speech-title")).toHaveText(
    "A Voice Made in Dialogue",
  );
  await page.locator(".audio-details > summary").click();
}
async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: `${evidence}/${name}.png` });
}

test("real example, shared playback, microphone recording, history and responsive screenshots", async ({
  page,
  context,
  request,
}) => {
  await context.grantPermissions(["microphone"], { origin: base });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  await expect(page.locator(".pa-demo-track .pa-wave line")).toHaveCount(180);
  for (const [width, height] of [
    [1586, 992],
    [1440, 900],
    [1366, 768],
  ]) {
    await page.setViewportSize({ width, height });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await screenshot(page, `practice-${width}x${height}-initial`);
  }
  await page.setViewportSize({ width: 1586, height: 992 });
  await page
    .getByRole("button", { name: "播放 示范音频", exact: true })
    .click();
  await expect
    .poll(() =>
      page
        .locator(".pa-demo-track audio")
        .evaluate((e: HTMLAudioElement) => e.currentTime),
    )
    .toBeGreaterThan(0.1);
  await expect(page.getByLabel("播放对象", { exact: true })).toHaveValue(
    "demo",
  );
  await expect(
    page.getByRole("button", { name: "暂停当前音频", exact: true }),
  ).toBeVisible();
  await screenshot(page, "playing");
  await page
    .getByRole("button", { name: /开始录音|重新录音/, exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "停止录音", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "下一句", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "总结", exact: true }),
  ).toBeDisabled();
  expect(
    await page
      .locator(".pa-demo-track audio")
      .evaluate((e: HTMLAudioElement) => e.paused),
  ).toBeTruthy();
  await screenshot(page, "recording");
  await page.waitForTimeout(1200);
  await page.locator(".pa-capture h3").click();
  await page.keyboard.press("Space");
  await expect(page.locator(".pa-save-status")).toContainText("录音已保存");
  await page
    .getByRole("button", { name: "播放 我的录音", exact: true })
    .click();
  await expect(page.getByLabel("播放对象", { exact: true })).toHaveValue("own");
  await expect
    .poll(() =>
      page
        .locator(".pa-recording-track audio")
        .evaluate((e: HTMLAudioElement) => e.currentTime),
    )
    .toBeGreaterThan(0.1);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载录音", exact: true }).click();
  expect(
    fs
      .readFileSync((await (await download).path())!)
      .subarray(0, 4)
      .toString(),
  ).toBe("RIFF");
  await page.getByRole("button", { name: "重新录音", exact: true }).click();
  await page.waitForTimeout(1100);
  await page.getByRole("button", { name: "停止录音", exact: true }).click();
  await expect(
    page.getByLabel("录音记录", { exact: true }).locator("option"),
  ).toHaveCount(2);
  await screenshot(page, "practice-recorded");
  await page.getByRole("button", { name: "收起侧栏", exact: true }).click();
  await screenshot(page, "practice-sidebar-collapsed");
  await page.getByRole("button", { name: "展开侧栏", exact: true }).click();
  await page.getByRole("button", { name: "检查识别差异", exact: true }).click();
  await expect
    .poll(
      async () => {
        const rows = await (
          await request.get(`${base}/api/sessions/${session.id}/recordings`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        ).json();
        return !!rows.find((r: any) => r.id === rows[0]?.id)?.content_feedback;
      },
      { timeout: 100000, intervals: [1000] },
    )
    .toBeTruthy();
  await page.getByRole("button", { name: "稿件操作", exact: true }).click();
  await screenshot(page, "speech-actions");
  await page.getByRole("button", { name: "稿件操作", exact: true }).click();
  for (const width of [1050, 760, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await screenshot(page, `practice-${width}`);
    if (width < 900) {
      await page
        .getByRole("button", { name: "练习当前句", exact: true })
        .click();
      await expect(
        page.getByRole("tab", { name: "教练", exact: true }),
      ).toBeVisible();
      await screenshot(page, `practice-panel-${width}`);
      await page.getByRole("button", { name: "返回稿件", exact: true }).click();
    }
  }
  await page.setViewportSize({ width: 1586, height: 992 });
  await page.getByRole("button", { name: "查看完整分析", exact: true }).click();
  await expect(page.locator(".analysis-content")).toContainText("识别文本差异");
  await screenshot(page, "analysis-local-recognition");
  await page.getByRole("button", { name: "总结", exact: true }).click();
  await expect(page.locator(".report-meta")).toContainText("1 / 6");
  await screenshot(page, "summary-real-recordings");
  await page.getByRole("button", { name: "稿件", exact: true }).click();
  await screenshot(page, "library");
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await expect(page.getByLabel("识别服务", { exact: true })).toBeVisible();
  await screenshot(page, "settings");
  expect(errors).toEqual([]);
});

test("offline feedback fixture: issue localization, missing times, historical assessment and report", async ({
  page,
  request,
}) => {
  const auth = { Authorization: `Bearer ${token}` };
  const wav = await (
    await request.get(`${base}/api/assets/${reference}?token=${token}`)
  ).body();
  const record = await (
    await request.post(
      `${base}/api/sentences/${session.sentences[1].id}/recordings`,
      {
        headers: auth,
        multipart: {
          file: {
            name: "offline-fixture.wav",
            mimeType: "audio/wav",
            buffer: wav,
          },
        },
      },
    )
  ).json();
  const feedback = {
    schema_version: 2,
    id: "offline",
    status: "success",
    provider: "UI TEST",
    provider_version: "OFFLINE FIXTURE · 非真实评测",
    score: 55,
    words: [],
    scores: {
      pronunciation: {
        value: 55,
        status: "available",
        source: "UI TEST",
        source_field: "fixture",
        raw_scale: [0, 100],
        conversion: "identity",
      },
      fluency: {
        value: null,
        status: "unavailable",
        source: "UI TEST",
        source_field: null,
        raw_scale: [0, 100],
        conversion: "none",
        reason: "No evidence",
      },
    },
    issues: [
      {
        id: "located",
        text: "dialogue",
        start: 0.8,
        end: 1.1,
        severity: "major",
        category: "pronunciation",
        problem: "此条反馈用于验证音频定位，需回听复核。",
        problem_en: "UI localization fixture; review by listening.",
        advice: "回放片段，再与示范朗读对比。",
        advice_en: "Replay the segment and compare with the example.",
        source: "UI TEST",
        time_source: "fixture seconds",
        localization_level: "word",
        evidence: {},
      },
      {
        id: "unlocated",
        text: "voice",
        start: null,
        end: null,
        severity: "minor",
        category: "pronunciation",
        problem: "此测试反馈没有可靠时间。",
        problem_en: "No reliable time in this fixture.",
        advice: "回听本句。",
        advice_en: "Replay this sentence.",
        source: "UI TEST",
        time_source: null,
        localization_level: "none",
        evidence: {},
      },
    ],
    raw_provider_result: { fixture: true },
  };
  let failure = false;
  await page.route("**/api/sessions/*/recordings", async (route) => {
    const response = await route.fetch();
    const rows = await response.json();
    await route.fulfill({
      response,
      json: rows.map((r: any) =>
        r.id === record.id
          ? {
              ...r,
              pronunciation_feedback: failure
                ? {
                    ...feedback,
                    status: "failed",
                    error: "UI TEST: provider unavailable",
                    issues: [],
                  }
                : feedback,
              assessment_history: [
                { ...feedback, id: "older", created_at: "2026-01-01" },
              ],
            }
          : r,
      ),
    });
  });
  await open(page, "?practice=prototype");
  await page.getByLabel("录音记录", { exact: true }).selectOption(record.id);
  await page.setViewportSize({ width: 1586, height: 992 });
  await screenshot(page, "practice-feedback-fixture");
  await page.getByRole("button", { name: "查看完整分析", exact: true }).click();
  await expect(page.locator(".pa-assessment")).toContainText("OFFLINE FIXTURE");
  await page.getByRole("button", { name: /dialogue 重点/ }).click();
  await page.getByRole("button", { name: "回放片段", exact: true }).click();
  const audio = page.locator(".pa-recording-track audio");
  await expect
    .poll(() => audio.evaluate((e: HTMLAudioElement) => e.currentTime))
    .toBeGreaterThanOrEqual(0.55);
  await expect
    .poll(() => audio.evaluate((e: HTMLAudioElement) => e.paused))
    .toBeTruthy();
  expect(
    await audio.evaluate((e: HTMLAudioElement) => e.currentTime),
  ).toBeLessThan(1.65);
  await screenshot(page, "analysis-feedback-fixture");
  await page.getByRole("button", { name: /voice 轻微/ }).click();
  await expect(
    page.getByRole("button", { name: "回放片段", exact: true }),
  ).toBeDisabled();
  await page.locator(".pa-assessment select").selectOption("older");
  await expect(page.locator(".pa-assessment")).toContainText("UI TEST");
  await page.getByLabel("我的录音播放位置").fill("0");
  await page
    .getByRole("button", { name: "播放 我的录音", exact: true })
    .click();
  await expect
    .poll(() => audio.evaluate((e: HTMLAudioElement) => e.currentTime))
    .toBeGreaterThan(1.7);
  await page.getByRole("button", { name: "总结", exact: true }).click();
  await expect(page.locator(".report-rows")).toContainText("dialogue");
  await screenshot(page, "summary-feedback-fixture");
  failure = true;
  await page.reload();
  await page.getByRole("button", { name: "查看完整分析", exact: true }).click();
  await expect(page.locator(".pa-assessment [role=alert]")).toContainText(
    "provider unavailable",
  );
  await screenshot(page, "assessment-error");
});

test("whole speech generation, playback speed and WAV export", async ({
  page,
  request,
}) => {
  const speech = await (
    await request.post(`${base}/api/sessions`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        title: "Whole speech verification",
        text: "We learn by listening. We explain an idea clearly.",
      },
    })
  ).json();
  await page.addInitScript(
    (id) => localStorage.setItem("session", id),
    speech.id,
  );
  await page.goto(`${base}/#token=${token}`);
  await expect(page.locator(".speech-title")).toHaveText(
    "Whole speech verification",
  );
  await page.getByRole("button", { name: "稿件操作", exact: true }).click();
  await page.getByRole("button", { name: "生成整篇示范", exact: true }).click();
  await expect
    .poll(
      async () => {
        const detail = await (
          await request.get(`${base}/api/sessions/${speech.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        ).json();
        return detail.sentences.every((s: any) => s.asset_id);
      },
      { timeout: 110000, intervals: [1000] },
    )
    .toBeTruthy();
  await page.getByLabel("播放选项", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "整篇播放", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "整篇播放", exact: true }).click();
  await expect(
    page.getByLabel("播放对象").locator("option[value=whole]"),
  ).toBeEnabled();
  await page.getByLabel("播放对象").selectOption("whole");
  await page.getByLabel("播放速度").selectOption("0.75");
  await page.getByRole("button", { name: "播放当前音频", exact: true }).click();
  const whole = page.locator(".playback-bar audio");
  await expect
    .poll(() => whole.evaluate((e: HTMLAudioElement) => e.currentTime))
    .toBeGreaterThan(0.1);
  expect(await whole.evaluate((e: HTMLAudioElement) => e.playbackRate)).toBe(
    0.75,
  );
  await page.locator(".audio-details > summary").click();
  await page
    .getByRole("button", { name: "播放 示范音频", exact: true })
    .click();
  await expect
    .poll(() => whole.evaluate((e: HTMLAudioElement) => e.paused))
    .toBeTruthy();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出整篇", exact: true }).click();
  expect(
    fs
      .readFileSync((await (await download).path())!)
      .subarray(0, 4)
      .toString(),
  ).toBe("RIFF");
});

test("new speech, editing, split and merge, keyboard focus and compatible legacy entry", async ({
  page,
}) => {
  await open(page, "?practice=legacy");
  await page.getByRole("button", { name: "新建演讲稿", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.getByLabel("标题", { exact: true }).fill("A clearer voice");
  await page
    .getByLabel("英文演讲稿", { exact: true })
    .fill(
      "Every meaningful change begins with a small decision. We choose to listen carefully.",
    );
  await screenshot(page, "new-speech");
  await page.getByRole("button", { name: "创建练习", exact: true }).click();
  await expect(page.locator(".speech-title")).toHaveText("A clearer voice");
  await page.getByText("编辑朗读稿与分句", { exact: false }).click();
  const input = page.getByLabel("实际朗读稿", { exact: true });
  await input.fill("Every change begins with a decision.");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.locator(".manuscript-sentence.selected > span:last-child"),
  ).toHaveText("Every change begins with a decision.");
  await input.evaluate((el: HTMLTextAreaElement) =>
    el.setSelectionRange(12, 12),
  );
  await page.getByRole("button", { name: "在光标处分句", exact: true }).click();
  await expect(page.locator(".manuscript-sentence")).toHaveCount(3);
  await page.getByRole("button", { name: "合并下一句", exact: true }).click();
  await expect(page.locator(".manuscript-sentence")).toHaveCount(2);
  await input.focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "停止录音", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Models & settings", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await expect(page.locator(".speech-title")).toHaveText("A clearer voice");
  await page.getByRole("button", { name: "New speech", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("permission failure, save failure with retained preview, delete and cloud consent dialogs", async ({
  page,
  context,
  request,
}) => {
  const headers = { Authorization: `Bearer ${token}` };
  const wav = await (
    await request.get(`${base}/api/assets/${reference}?token=${token}`)
  ).body();
  await request.post(
    `${base}/api/sentences/${session.sentences[1].id}/recordings`,
    {
      headers,
      multipart: {
        file: {
          name: "permission-test.wav",
          mimeType: "audio/wav",
          buffer: wav,
        },
      },
    },
  );
  await context.grantPermissions(["microphone"], { origin: base });
  await open(page);
  await page.evaluate(() =>
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: () =>
        Promise.reject(
          new DOMException("Permission denied", "NotAllowedError"),
        ),
    }),
  );
  await page
    .getByRole("button", { name: /开始录音|重新录音/, exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Permission denied");
  await expect(
    page.getByRole("button", { name: /开始录音|重新录音/, exact: true }),
  ).toBeEnabled();
  await screenshot(page, "microphone-denied");
  await page.reload();
  await expect(page.locator(".speech-title")).toBeVisible();
  await page.route("**/api/sentences/*/recordings", (route) =>
    route.fulfill({
      status: 500,
      json: { detail: "UI TEST: save unavailable" },
    }),
  );
  await page
    .getByRole("button", { name: /开始录音|重新录音/, exact: true })
    .click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "停止录音", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("save unavailable");
  await expect(page.locator(".pa-recording-track audio")).toHaveAttribute(
    "src",
    /^blob:/,
  );
  await screenshot(page, "save-error-preview");
  await page.unroute("**/api/sentences/*/recordings");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "发音评测", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "发音评测", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("上传");
  await screenshot(page, "cloud-consent");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.locator(".audio-details > summary").click();
  await page.getByRole("button", { name: "删除录音", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("删除这条录音及反馈");
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(
      () => !!document.activeElement?.closest("[role=dialog]"),
    ),
  ).toBeTruthy();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("settings retain optional model choices, directories and bilingual labels", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await page.getByLabel("Voice model", { exact: true }).selectOption("qwen");
  await expect(page.getByLabel("Delivery", { exact: true })).toBeVisible();
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
  await expect(page.getByRole("status")).toContainText("applied");
  await page.getByLabel("Local device", { exact: true }).selectOption("cuda");
  await expect(page.getByLabel("Local device", { exact: true })).toHaveValue(
    "cuda",
  );
  await page
    .getByLabel("Local ASR model", { exact: true })
    .selectOption("parakeet");
  await expect(page.getByLabel("Local device", { exact: true })).toHaveValue(
    "cpu",
  );
  await expect(page.getByLabel("Local device", { exact: true })).toBeDisabled();
  await page.getByRole("link", { name: "File storage", exact: true }).click();
  await screenshot(page, "settings-storage");
  await page
    .locator(".directory")
    .first()
    .getByRole("button", { name: "Change", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Select local files", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Absolute directory path", { exact: true }),
  ).toBeFocused();
  await screenshot(page, "directory-dialog");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await expect(page.getByLabel("示范模型", { exact: true })).toHaveValue(
    "qwen-small",
  );
  await expect(page.getByLabel("声线", { exact: true })).toHaveValue("Aiden");
});

test("long title, long script, unavailable example, empty and loading states", async ({
  page,
  request,
}) => {
  const long = await (
    await request.post(`${base}/api/sessions`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        title:
          "Long title " +
          "An investigation into voice, dialogue and the spaces between ideas — ".repeat(
            2,
          ),
        text: "A thoughtful conversation asks us to listen closely, give others enough context, pause when the meaning changes, and compare our understanding with what was actually said. ".repeat(
          60,
        ),
      },
    })
  ).json();
  await page.addInitScript(
    (id) => localStorage.setItem("session", id),
    long.id,
  );
  await page.goto(`${base}/#token=${token}`);
  await expect(page.locator(".manuscript-sentence")).toHaveCount(60);
  await expect(
    page
      .locator(".transport-empty")
      .getByText("尚未生成示范音频", { exact: true }),
  ).toBeVisible();
  await screenshot(page, "long-script");
  for (const width of [1366, 1050, 760, 390]) {
    await page.setViewportSize({ width, height: 768 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("**/api/sessions", (route) => route.fulfill({ json: [] }));
  await page.reload();
  await expect(page.locator(".welcome")).toContainText("暂无稿件");
  await screenshot(page, "empty-library");
  await page.unroute("**/api/sessions");
  await page.route("**/api/sessions", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "正在加载稿件", exact: true }),
  ).toBeVisible();
  await screenshot(page, "loading");
});
