import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
let server: ChildProcess, base: string, token: string, session: any;
const evidence = "docs/evidence/frontend-redesign";
test.beforeAll(async ({ request }) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "speech-sidebar-"));
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
    },
  );
  base = `http://127.0.0.1:${connection.port}`;
  token = connection.token;
  const auth = { Authorization: `Bearer ${token}` };
  session = await (
    await request.post(`${base}/api/sessions`, {
      headers: auth,
      data: {
        title: "Sidebar state verification",
        text: "A clear message requires a thoughtful structure and careful listening. ".repeat(
          40,
        ),
      },
    })
  ).json();
  // Explicit synthetic PCM audio verifies transport continuity, not speech quality.
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
      Math.round(Math.sin((i / 16000) * 440 * 2 * Math.PI) * 1600),
      44 + i * 2,
    );
  await request.post(
    `${base}/api/sentences/${session.sentences[0].id}/recordings`,
    {
      headers: auth,
      multipart: {
        file: {
          name: "synthetic-continuity.wav",
          mimeType: "audio/wav",
          buffer: wav,
        },
      },
    },
  );
});
test.afterAll(() => server?.kill());
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript((id) => {
    localStorage.setItem("session", id);
    localStorage.setItem("language", "zh");
    localStorage.setItem("speech-reader-mode", "script");
  }, session.id);
  await page.goto(`${base}/#token=${token}`);
  await expect(page.locator(".speech-title")).toHaveText(
    "Sidebar state verification",
  );
  await page.locator(".audio-details > summary").click();
});

test("sidebar collapse preserves selection, manuscript scroll, audio element and playback; preference persists", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1586, height: 992 });
  const reading = page.locator(".reading-scroll");
  await reading.evaluate((e) => (e.scrollTop = 260));
  const top = await reading.evaluate((e) => e.scrollTop);
  const before = await page.locator(".reading-column").boundingBox();
  await page
    .getByRole("button", { name: "播放 我的录音", exact: true })
    .click();
  const audio = page.locator(".pa-recording-track audio");
  await audio.evaluate((e) => ((window as any).sidebarAudioElement = e));
  await expect
    .poll(() => audio.evaluate((e: HTMLAudioElement) => e.currentTime))
    .toBeGreaterThan(0.2);
  const elapsed = await audio.evaluate((e: HTMLAudioElement) => e.currentTime);
  // Secondary track playback now lives below the reader; restore the user's reading position before testing layout changes.
  await reading.evaluate((e) => (e.scrollTop = 260));
  const toggle = page.getByRole("button", { name: "收起侧栏", exact: true });
  await toggle.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(220);
  await expect(
    page.getByRole("button", { name: "展开侧栏", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  expect(
    (await page.locator(".reading-column").boundingBox())!.width,
  ).toBeGreaterThan(before!.width + 150);
  expect(
    await audio.evaluate((e) => e === (window as any).sidebarAudioElement),
  ).toBeTruthy();
  await expect
    .poll(() => audio.evaluate((e: HTMLAudioElement) => e.currentTime))
    .toBeGreaterThan(elapsed);
  expect(await audio.evaluate((e: HTMLAudioElement) => e.paused)).toBeFalsy();
  expect(await reading.evaluate((e) => e.scrollTop)).toBe(top);
  await expect(
    page.locator(".manuscript-sentence.selected .sentence-number"),
  ).toHaveText("01");
  await expect(
    page.getByRole("button", { name: "练习", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("button", { name: "分析", exact: true }),
  ).toHaveAttribute("title", "分析");
  await page.screenshot({ path: `${evidence}/sidebar-collapsed-playing.png` });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "展开侧栏", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "展开侧栏", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "收起侧栏", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".speech-list")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "收起侧栏", exact: true }),
  ).toBeVisible();
});

test("sidebar remains operable during recording and does not stop microphone capture", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["microphone"], { origin: base });
  await page.getByRole("button", { name: "重新录音", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "停止录音", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "收起侧栏", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "停止录音", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "分析", exact: true }),
  ).toBeDisabled();
  await page.waitForTimeout(1100);
  await page.getByRole("button", { name: "展开侧栏", exact: true }).click();
  await expect(page.locator(".pa-capture p")).toContainText("0:01");
  await page.getByRole("button", { name: "停止录音", exact: true }).click();
  await expect(page.locator(".pa-save-status")).toContainText("录音已保存");
});

test("sidebar rail and drawer at desktop, narrow desktop and phone sizes", async ({
  page,
}) => {
  for (const width of [1586, 1440, 1366, 1050, 760, 390]) {
    await page.setViewportSize({ width, height: 900 });
    if (width < 1200)
      await expect(
        page.getByRole("button", { name: "展开侧栏", exact: true }),
      ).toBeVisible();
    const collapse = page.getByRole("button", {
      name: "收起侧栏",
      exact: true,
    });
    if (await collapse.isVisible()) await collapse.click();
    await expect(
      page.getByRole("button", { name: "展开侧栏", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "练习", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `${evidence}/sidebar-rail-${width}.png` });
    await page.getByRole("button", { name: "展开侧栏", exact: true }).click();
    await expect(page.locator(".speech-list")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "收起侧栏", exact: true }),
    ).toBeVisible();
    if (width < 1200) {
      await page.screenshot({
        path: `${evidence}/sidebar-drawer-${width}.png`,
      });
      await page.reload();
      await expect(
        page.getByRole("button", { name: "收起侧栏", exact: true }),
      ).toBeVisible();
      await expect(page.locator(".speech-list")).toBeVisible();
      await page.getByRole("button", { name: "收起侧栏", exact: true }).click();
    }
  }
});
