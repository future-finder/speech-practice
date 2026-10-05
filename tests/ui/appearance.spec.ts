import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
let server: ChildProcess, base: string, token: string, session: any;
const evidence = "docs/evidence/appearance";
test.beforeAll(async ({ request }) => {
  fs.mkdirSync(evidence, { recursive: true });
  server = spawn(
    path.resolve(".venv/Scripts/python.exe"),
    ["backend/server.py"],
    {
      env: {
        ...process.env,
        SPEECH_DATA_DIR: fs.mkdtempSync(
          path.join(os.tmpdir(), "speech-appearance-"),
        ),
        SPEECH_UI_DIR: path.resolve("dist"),
        PYTHONUTF8: "1",
      },
      windowsHide: true,
    },
  );
  const c = await new Promise<{ port: number; token: string }>(
    (resolve, reject) => {
      let text = "";
      server.stdout!.on("data", (chunk) => {
        text += chunk;
        if (text.includes("\n"))
          resolve(JSON.parse(text.slice(0, text.indexOf("\n"))));
      });
      server.once("error", reject);
    },
  );
  base = `http://127.0.0.1:${c.port}`;
  token = c.token;
  const auth = { Authorization: `Bearer ${token}` };
  session = await (
    await request.post(base + "/api/sessions", {
      headers: auth,
      data: {
        title: "A Voice Made in Dialogue",
        text: "We often think of a voice as something we find on our own. My voice was not built in isolation; it was made in dialogue. Thank you for listening.",
      },
    })
  ).json();
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
      Math.round(Math.sin((i / 16000) * 440 * Math.PI * 2) * 3000),
      44 + i * 2,
    );
  await request.post(
    `${base}/api/sentences/${session.sentences[0].id}/recordings`,
    {
      headers: auth,
      multipart: {
        file: {
          name: "synthetic-state.wav",
          mimeType: "audio/wav",
          buffer: wav,
        },
      },
    },
  );
});
test.afterAll(() => server?.kill());
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript((id) => {
    localStorage.setItem("session", id);
    localStorage.setItem("language", "zh");
  }, session.id);
  await page.goto(`${base}/#token=${token}`);
  await expect(page.locator(".speech-title")).toHaveText(
    "A Voice Made in Dialogue",
  );
  await page.getByRole("tab", { name: "专注", exact: true }).click();
  await page.locator(".audio-details > summary").click();
});
test("materials and real imported images persist, remain decorative and can be replaced or deleted", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator(".botanical-edge")).toHaveAttribute(
    "data-asset",
    "none",
  );
  expect(
    await page
      .locator(".botanical-edge")
      .evaluate((e) => getComputedStyle(e).backgroundImage),
  ).toBe("none");
  await page.screenshot({ path: `${evidence}/pure-practice.png` });
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByLabel("开启装饰", { exact: true }).check();
  await page.getByLabel("左下角素材", { exact: true }).selectOption("trace");
  await page
    .getByLabel("右上角素材", { exact: true })
    .selectOption("landscape");
  await page.getByLabel("右上角素材不透明度", { exact: true }).fill("28");
  await page.screenshot({ path: `${evidence}/appearance-settings.png` });
  // Actual local raster file, converted and stored; no network image fixture.
  await page
    .getByLabel("左下角素材导入图片", { exact: true })
    .setInputFiles(path.resolve("public/images/practice-botanical.png"));
  await expect(page.getByLabel("左下角素材", { exact: true })).toHaveValue(
    "custom",
  );
  await expect
    .poll(() =>
      page
        .locator(".decor-preview[data-slot=sidebar] .decor-material")
        .evaluate((e) => getComputedStyle(e).backgroundImage),
    )
    .toContain("blob:");
  // Decode the URL used by CSS; merely having a blob URL is insufficient.
  await page
    .locator(".decor-preview[data-slot=sidebar] .decor-material")
    .evaluate(async (e) => {
      const url = getComputedStyle(e).backgroundImage.slice(5, -2);
      const image = new Image();
      image.src = url;
      await image.decode();
      if (!image.naturalWidth)
        throw new Error("Custom background failed to decode");
    });
  await page.getByLabel("左下角素材水平位置", { exact: true }).fill("76");
  await page.getByLabel("左下角素材模糊", { exact: true }).fill("3");
  await page.reload();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await expect(page.getByLabel("左下角素材", { exact: true })).toHaveValue(
    "custom",
  );
  await expect(
    page.getByLabel("左下角素材水平位置", { exact: true }),
  ).toHaveValue("76");
  await expect
    .poll(() =>
      page
        .locator(".decor-preview[data-slot=sidebar] .decor-material")
        .evaluate((e) => getComputedStyle(e).backgroundImage),
    )
    .toContain("blob:");
  const previousImage = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("speech-appearance-v1")!).sidebar.image,
  );
  await page
    .getByLabel("左下角素材导入图片", { exact: true })
    .setInputFiles(path.resolve("public/images/practice-mountains.jpg"));
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("speech-appearance-v1")!).sidebar
            .image,
      ),
    )
    .not.toBe(previousImage);
  await expect
    .poll(() =>
      page.evaluate(
        (id) =>
          new Promise((resolve) => {
            const open = indexedDB.open("speech-visual-assets", 1);
            open.onsuccess = () => {
              const db = open.result,
                tx = db.transaction("images", "readonly"),
                request = tx.objectStore("images").get(id);
              tx.oncomplete = () => {
                resolve(request.result === undefined);
                db.close();
              };
            };
          }),
        previousImage,
      ),
    )
    .toBe(true);
  await page
    .getByLabel("右上角素材导入图片", { exact: true })
    .setInputFiles(path.resolve("public/images/practice-botanical.png"));
  await expect(page.getByLabel("右上角素材", { exact: true })).toHaveValue(
    "custom",
  );
  await page.getByRole("button", { name: "练习", exact: true }).click();
  await page.getByRole("tab", { name: "专注", exact: true }).click();
  await expect(page.locator(".current-sentence > .decor-slot")).toHaveAttribute(
    "data-asset",
    "custom",
  );
  await expect
    .poll(() =>
      page
        .locator(".current-sentence .decor-material")
        .evaluate((e) => getComputedStyle(e).backgroundImage),
    )
    .toContain("blob:");
  expect(
    await page
      .locator(".current-sentence > .decor-slot")
      .evaluate((e) => getComputedStyle(e).pointerEvents),
  ).toBe("none");
  await page.waitForTimeout(300);
  await page
    .locator(".current-sentence")
    .screenshot({ path: `${evidence}/custom-reader-detail.png` });
  await page.screenshot({ path: `${evidence}/custom-practice.png` });
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByLabel("左下角素材导入图片", { exact: true }).setInputFiles({
    name: "invalid.png",
    mimeType: "image/png",
    buffer: Buffer.from("invalid raster"),
  });
  await expect(page.locator(".appearance-settings [role=alert]")).toContainText(
    "失败",
  );
  await expect(page.getByLabel("左下角素材", { exact: true })).toHaveValue(
    "custom",
  );
  await page
    .locator(".appearance-slot-controls")
    .first()
    .getByRole("button", { name: "删除图片", exact: true })
    .click();
  await expect(page.getByLabel("左下角素材", { exact: true })).toHaveValue(
    "none",
  );
  await expect(page.getByLabel("右上角素材", { exact: true })).toHaveValue(
    "custom",
  );
  await page
    .getByRole("button", { name: "恢复全部默认外观", exact: true })
    .click();
  await expect(page.getByLabel("开启装饰", { exact: true })).not.toBeChecked();
  await page.reload();
  await expect(page.locator(".current-sentence > .decor-slot")).toHaveAttribute(
    "data-asset",
    "none",
  );
});
test("continuous real playback, live capture, held waveform and responsive decorative layout", async ({
  page,
}) => {
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByLabel("开启装饰", { exact: true }).check();
  await page.getByLabel("左下角素材", { exact: true }).selectOption("geometry");
  await page.getByLabel("右上角素材", { exact: true }).selectOption("gradient");
  await page.getByRole("button", { name: "练习", exact: true }).click();
  await page.getByRole("tab", { name: "全文", exact: true }).click();
  await page.locator(".manuscript-sentence").first().hover();
  await page.locator(".audio-details > summary").click();
  await page
    .getByRole("button", { name: "播放 我的录音", exact: true })
    .click();
  await expect(page.locator(".pa-recording-track .pa-audio")).toHaveClass(
    /is-playing/,
  );
  await expect
    .poll(() =>
      page
        .locator(".pa-recording-track audio")
        .evaluate((e: HTMLAudioElement) => e.currentTime),
    )
    .toBeGreaterThan(0.1);
  const positions: string[] = [];
  for (let i = 0; i < 7; i++) {
    positions.push(
      await page
        .locator(".pa-recording-track .pa-playhead")
        .evaluate((e) => (e as HTMLElement).style.left),
    );
    await page.waitForTimeout(40);
  }
  expect(new Set(positions).size).toBeGreaterThan(3);
  await page.screenshot({ path: `${evidence}/playing.png` });
  await page.getByRole("button", { name: "重新录音", exact: true }).click();
  await expect(page.locator(".speech-workspace")).toHaveClass(/recording-mode/);
  await expect(page.locator(".live-waveform")).toHaveAttribute(
    "data-state",
    "live",
  );
  await page.waitForTimeout(650);
  expect(
    await page
      .locator(".live-waveform canvas")
      .evaluate((e: HTMLCanvasElement) =>
        e
          .getContext("2d")!
          .getImageData(0, 0, 360, 48)
          .data.some((value, i) => i % 4 === 3 && value > 0),
      ),
  ).toBeTruthy();
  await page.screenshot({ path: `${evidence}/recording.png` });
  await page.getByRole("button", { name: "停止录音", exact: true }).click();
  await expect(page.locator(".pa-save-status")).toContainText("录音已保存");
  await expect(page.locator(".live-waveform")).toHaveAttribute(
    "data-state",
    "held",
  );
  await expect(page.locator(".speech-workspace")).not.toHaveClass(
    /recording-mode/,
  );
  await page.screenshot({ path: `${evidence}/recording-saved.png` });
  for (const width of [1586, 1366, 1050, 760, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    if (width < 900)
      await page
        .getByRole("button", { name: "练习当前句", exact: true })
        .click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${evidence}/practice-${width}.png` });
    if (width < 900)
      await page.getByRole("button", { name: "返回稿件", exact: true }).click();
  }
});
test("motion preferences, system reduction, and storage failure are explicit", async ({
  page,
}) => {
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByLabel("动效", { exact: true }).selectOption("off");
  expect(
    await page
      .locator(".sidebar-toggle")
      .evaluate((e) => getComputedStyle(e).transitionDuration),
  ).toBe("0s");
  await page.reload();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await expect(page.getByLabel("动效", { exact: true })).toHaveValue("off");
  await page.getByLabel("动效", { exact: true }).selectOption("reduced");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  await page.getByLabel("动效", { exact: true }).selectOption("full");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".sidebar-toggle")
      .evaluate((e) => getComputedStyle(e).transitionDuration),
  ).toBe("0s");
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "speech-appearance-v1")
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      return set.call(this, key, value);
    };
  });
  await page.getByLabel("开启装饰", { exact: true }).click();
  await expect(page.locator(".appearance-settings [role=alert]")).toContainText(
    "未保存",
  );
  await expect(page.getByLabel("开启装饰", { exact: true })).not.toBeChecked();
});
