// Real local backend; explicitly synthetic assessment data only for visual QA.
const { chromium } = require("@playwright/test");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const evidence = path.resolve("docs/evidence/reference-reconstruction");
const round = process.argv[2] || "round-1";
fs.mkdirSync(evidence, { recursive: true });
const backend = spawn(
  path.resolve(".venv/Scripts/python.exe"),
  ["backend/server.py"],
  {
    windowsHide: true,
    env: {
      ...process.env,
      PYTHONUTF8: "1",
      SPEECH_DATA_DIR: fs.mkdtempSync(
        path.join(os.tmpdir(), "speech-reference-"),
      ),
      SPEECH_UI_DIR: path.resolve("dist"),
    },
  },
);
let browser;
(async () => {
  const conn = await new Promise((resolve, reject) => {
    let buf = "";
    backend.stdout.on("data", (d) => {
      buf += d;
      if (buf.includes("\n")) resolve(JSON.parse(buf.split("\n")[0]));
    });
    backend.once("error", reject);
    backend.once("exit", (c) => reject(Error(`Backend exit ${c}`)));
    backend.stderr.on("data", (d) => process.stderr.write(d));
  });
  const base = `http://127.0.0.1:${conn.port}`,
    headers = {
      Authorization: `Bearer ${conn.token}`,
      "Content-Type": "application/json",
    };
  const api = async (url, method = "GET", body) => {
    const r = await fetch(base + "/api" + url, {
      method,
      headers,
      body: body && JSON.stringify(body),
    });
    if (!r.ok) throw Error(await r.text());
    return r.json();
  };
  const text =
    "Good morning everyone. Today, I want to talk about the power of small actions. It’s easy to think that real change only happens through big, dramatic moments — a major invention, a groundbreaking idea, or a once-in-a-lifetime opportunity. But the truth is, meaningful progress usually starts much smaller than that. Every positive change in our lives begins with a single, simple decision. A choice to show up. A decision to try. A small step, repeated over time, that builds into something remarkable. Think about learning a new skill, getting healthier, or making a difference in your community. None of these happen overnight. They happen because of small, consistent actions. Thank you.";
  const session = await api("/sessions", "POST", {
    title: "The Power of Small Actions",
    text,
  });
  await api(`/sessions/${session.id}/progress`, "PATCH", {
    sentence_id: session.sentences[1].id,
  });
  for (const [title, text] of [
    [
      "Turning Challenges into Opportunities",
      "A challenge is an opportunity to grow. Begin with one small step.",
    ],
    [
      "A Healthier, Happier You",
      "Choose a small change each day. Build a habit that lasts.",
    ],
    [
      "My Interview Introduction",
      "Thank you for the opportunity. I study software engineering.",
    ],
    [
      "A More Focused Life",
      "Focus on the task in front of you. Learn through practice.",
    ],
    [
      "The Future of Work",
      "Technology changes the way we work. Keep learning.",
    ],
  ])
    await api("/sessions", "POST", { title, text });
  browser = await chromium.launch({
    headless: true,
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  });
  const context = await browser.newContext({
    viewport: { width: 1586, height: 992 },
    permissions: ["microphone"],
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const anatomy = {};
  const measureAnatomy = async (state) => {
    anatomy[state] = await page.evaluate(() =>
      Object.fromEntries(
        [
          ".reader-toolbar",
          ".reader-toolbar .segmented-control",
          ".sentence-navigation",
          ".reader-edit",
          ".playback-bar",
          ".coach-overview",
        ].map((selector) => {
          const r = document.querySelector(selector).getBoundingClientRect();
          return [selector, { x: r.x, y: r.y, w: r.width, h: r.height }];
        }),
      ),
    );
    for (const [selector, rect] of Object.entries(anatomy[state])) {
      const baseline = anatomy.unassessed[selector];
      for (const dimension of ["x", "y", "w", "h"]) {
        if (Math.abs(rect[dimension] - baseline[dimension]) > 1)
          throw Error(
            `${state}: ${selector}.${dimension} moved ${rect[dimension] - baseline[dimension]}px`,
          );
      }
    }
  };
  const settle = async () => {
    await page.mouse.move(1580, 980);
    await page.evaluate(() =>
      Promise.all(
        Array.from(document.images, (img) => img.decode().catch(() => {})),
      ),
    );
  };
  await page.addInitScript((id) => {
    localStorage.setItem("language", "en");
    localStorage.setItem("session", id);
    localStorage.setItem("speech-reader-mode", "focus");
    localStorage.setItem("speech-sidebar-collapsed", "false");
  }, session.id);
  await page.goto(`${base}/#token=${conn.token}`);
  await page
    .getByRole("heading", { name: session.title, exact: true })
    .waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await settle();
  await measureAnatomy("unassessed");
  await page.screenshot({ path: path.join(evidence, `${round}-focus.png`) });
  const geometry = await page.evaluate(() =>
    Object.fromEntries(
      [
        ".speech-workspace",
        ".app-sidebar",
        ".reading-column",
        ".practice-panel",
        ".reading-scroll",
        ".focus-copy",
        ".playback-bar",
      ].map((sel) => {
        const e = document.querySelector(sel),
          r = e.getBoundingClientRect();
        return [sel, { x: r.x, y: r.y, w: r.width, h: r.height }];
      }),
    ),
  );
  await page.getByRole("tab", { name: "Script", exact: true }).click();
  await settle();
  await measureAnatomy("script-unassessed");
  await page.screenshot({ path: path.join(evidence, `${round}-script.png`) });
  await page.getByRole("button", { name: "Analysis", exact: true }).click();
  await settle();
  await page.screenshot({ path: path.join(evidence, `${round}-analysis.png`) });
  await page.getByRole("button", { name: "Summary", exact: true }).click();
  await settle();
  await page.screenshot({ path: path.join(evidence, `${round}-report.png`) });
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await settle();
  await page.screenshot({ path: path.join(evidence, `${round}-home.png`) });
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await settle();
  const libraryAssets = await page
    .locator(".speech-cover img")
    .evaluateAll((images) => images.map((img) => img.getAttribute("src")));
  if (new Set(libraryAssets).size !== libraryAssets.length)
    throw Error("Duplicate Library cover");
  const sidebarOverflow = await page.evaluate(() => {
    const list = document.querySelector(".speech-list");
    const old = list.scrollTop;
    list.scrollTop = list.scrollHeight;
    const last = list.lastElementChild.getBoundingClientRect();
    const area = list.getBoundingClientRect();
    const result = {
      height: area.height,
      scrollHeight: list.scrollHeight,
      lastItemAccessible: last.bottom <= area.bottom + 1,
    };
    list.scrollTop = old;
    return result;
  });
  if (!sidebarOverflow.lastItemAccessible)
    throw Error("Sidebar last item clipped even after scrolling");
  if (/UI TEST|visual fixture/i.test(await page.locator("body").innerText()))
    throw Error("Developer text in UI");
  await page.screenshot({ path: path.join(evidence, `${round}-library.png`) });
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await page.getByText("Practice Activity", { exact: true }).waitFor();
  await settle();
  await page.screenshot({ path: path.join(evidence, `${round}-progress.png`) });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await settle();
  await page.screenshot({ path: path.join(evidence, `${round}-settings.png`) });
  await page.getByRole("link", { name: "Appearance", exact: true }).click();
  const wallpaper = page.getByRole("checkbox", {
    name: "Show background wallpaper",
    exact: true,
  });
  await wallpaper.uncheck();
  await page.reload();
  await page.waitForFunction(
    () => document.documentElement.dataset.wallpaper === "off",
  );
  if (
    await page.evaluate(
      () => getComputedStyle(document.body).backgroundImage !== "none",
    )
  )
    throw Error("Wallpaper off did not remove background image");
  await page.waitForFunction(() => {
    const r = document
      .querySelector(".speech-workspace")
      .getBoundingClientRect();
    return (
      Math.abs(r.x) < 1 &&
      Math.abs(r.y) < 1 &&
      Math.abs(r.width - innerWidth) < 1 &&
      Math.abs(r.height - innerHeight) < 1
    );
  });
  await page.getByRole("tab", { name: "Focus", exact: true }).click();
  await settle();
  await page.screenshot({
    path: path.join(evidence, `${round}-focus-no-wallpaper.png`),
  });
  for (const size of [
    { width: 1920, height: 1080 },
    { width: 1050, height: 700 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    await page.waitForFunction(() => {
      const r = document
        .querySelector(".speech-workspace")
        .getBoundingClientRect();
      return (
        Math.abs(r.width - innerWidth) < 1 &&
        Math.abs(r.height - innerHeight) < 1 &&
        document.documentElement.scrollWidth <= innerWidth
      );
    });
    await settle();
    await page.screenshot({
      path: path.join(evidence, `${round}-no-wallpaper-${size.width}.png`),
    });
  }
  await page.setViewportSize({ width: 1586, height: 992 });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("link", { name: "Appearance", exact: true }).click();
  if (await wallpaper.isChecked())
    throw Error("Wallpaper preference did not persist");
  await wallpaper.check();
  await page.waitForFunction(
    () => document.documentElement.dataset.wallpaper === "on",
  );
  await settle();
  await page.screenshot({
    path: path.join(evidence, `${round}-appearance.png`),
  });
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("tab", { name: "Focus", exact: true }).click();
  await page
    .getByRole("button", { name: "Start recording", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Stop recording", exact: true })
    .waitFor();
  await page.waitForTimeout(650);
  await settle();
  await page.screenshot({
    path: path.join(evidence, `${round}-recording.png`),
  });
  await page
    .getByRole("button", { name: "Stop recording", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Recording saved" })
    .waitFor();
  await settle();
  await measureAnatomy("recorded");
  await page.screenshot({
    path: path.join(evidence, `${round}-focus-recorded.png`),
  });
  for (const size of [
    { width: 1050, height: 700 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(100);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    if (overflow) throw Error(`Overflow at ${size.width}`);
    await settle();
    await page.screenshot({
      path: path.join(evidence, `${round}-${size.width}.png`),
    });
  }
  await page.setViewportSize({ width: 1586, height: 992 });
  // Route fixture only: never written to the backend or shipped as user data.
  const metric = (value) => ({
    value,
    status: "available",
    source: "Example assessment",
    source_field: "fixture",
    raw_scale: [0, 100],
    conversion: "identity",
  });
  const fixture = {
    schema_version: 2,
    id: "visual-fixture",
    status: "success",
    provider: "Example assessment",
    provider_version: "Offline example",
    score: 82,
    words: [],
    scores: { pronunciation: metric(82), intelligibility: metric(80) },
    issues: [
      {
        id: "talk",
        text: "talk",
        start: 0.1,
        end: 0.3,
        severity: "minor",
        category: "pronunciation",
        problem: "测试样例：回听发音。",
        problem_en: "Review the /t/ sound.",
        advice: "回放后与示范对比。",
        advice_en: "Replay and compare with an example.",
        source: "Example assessment",
        time_source: "fixture",
        localization_level: "word",
        evidence: {},
      },
    ],
    raw_provider_result: { fixture: true },
  };
  await page.route("**/api/sessions/*/recordings", async (route) => {
    const response = await route.fetch();
    const rows = await response.json();
    await route.fulfill({
      response,
      json: rows.map((r) => ({
        ...r,
        pronunciation_feedback: fixture,
        content_feedback: {
          transcript: {
            text: r.spoken_text,
            uncertain: false,
            provider: "Example assessment",
          },
          differences: [],
          observations: [
            {
              kind: "recognized_words_per_minute",
              value: 167,
              source: "Example assessment",
              notice: "Offline example",
            },
          ],
        },
      })),
    });
  });
  await page.reload();
  await page
    .getByRole("heading", { name: session.title, exact: true })
    .waitFor();
  await page
    .getByText("82 / 100", {
      exact: true,
    })
    .waitFor();
  await settle();
  await measureAnatomy("assessed");
  await page.screenshot({
    path: path.join(evidence, `${round}-focus-assessed-fixture.png`),
  });
  await page.getByRole("tab", { name: "Script", exact: true }).click();
  await settle();
  await measureAnatomy("script-assessed");
  await page.screenshot({
    path: path.join(evidence, `${round}-script-assessed-fixture.png`),
  });
  await page.getByRole("button", { name: "Analysis", exact: true }).click();
  await settle();
  await page.screenshot({
    path: path.join(evidence, `${round}-analysis-assessed-fixture.png`),
  });
  await page.getByRole("button", { name: "Summary", exact: true }).click();
  await page.getByText("82", { exact: true }).first().waitFor();
  await settle();
  await page.screenshot({
    path: path.join(evidence, `${round}-report-assessed-fixture.png`),
  });
  fs.writeFileSync(
    path.join(evidence, `${round}-audit.json`),
    JSON.stringify(
      {
        geometry,
        anatomy,
        libraryAssets,
        sidebarOverflow,
        errors,
        syntheticData:
          "Seeded demo speeches; fake microphone for recording QA. Files with assessed-fixture suffix use route-only offline example assessment scores; never persisted or shipped as real user feedback.",
        recording: "Real backend saved fake-microphone WAV successfully.",
      },
      null,
      2,
    ),
  );
  if (errors.length) throw Error(errors.join("\n"));
  console.log(JSON.stringify({ geometry, errors, evidence }, null, 2));
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    backend.kill();
  });
