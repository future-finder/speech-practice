// Runs the existing Electron wrapper with isolated data and records UI evidence.
const { _electron } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
(async () => {
  const evidence = path.resolve("docs/evidence/frontend-redesign");
  fs.mkdirSync(evidence, { recursive: true });
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "speech-desktop-redesign-"),
  );
  if (process.env.SPEECH_TEST_EXE)
    fs.writeFileSync(
      path.join(root, "settings.json"),
      JSON.stringify({
        model_dir: path.join(
          process.env.LOCALAPPDATA,
          "speech-practice",
          "models",
        ),
      }),
    );
  const desktop = await _electron.launch({
    executablePath: process.env.SPEECH_TEST_EXE || require("electron"),
    args: [
      ...(process.env.SPEECH_TEST_EXE ? [] : ["."]),
      `--user-data-dir=${path.join(root, "electron-profile")}`,
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
    env: {
      ...process.env,
      SPEECH_DATA_DIR: root,
      SPEECH_TEST_HIDDEN: "1",
      ...(process.env.SPEECH_TEST_EXE
        ? {
            PATH: path.join(process.env.SystemRoot, "System32"),
            PYTHONPATH: "",
            VIRTUAL_ENV: "",
          }
        : {}),
    },
    timeout: 60000,
  });
  try {
    const page = await desktop.firstWindow();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.emulateMedia({ reducedMotion: "reduce" });
    const capture = async (name) => {
      const png = await desktop.evaluate(async ({ BrowserWindow }) => {
        const image =
          await BrowserWindow.getAllWindows()[0].webContents.capturePage(
            undefined,
            { stayHidden: true, stayAwake: true },
          );
        return image.toPNG().toString("base64");
      });
      fs.writeFileSync(path.join(evidence, name), Buffer.from(png, "base64"));
    };
    await page.waitForSelector(".welcome");
    const bridge = await page.evaluate(() => window.desktop.connection());
    const response = await fetch(`${bridge.base}/api/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bridge.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "A Voice Made in Dialogue",
        text: "We often think of a voice as something we find on our own. My voice was not built in isolation; it was made in dialogue. Thank you for listening.",
      }),
    });
    if (!response.ok)
      throw new Error("Desktop backend failed to create a test speech");
    const speech = await response.json();
    await page.evaluate((id) => {
      localStorage.setItem("language", "zh");
      localStorage.setItem("session", id);
    }, speech.id);
    await page.reload();
    await page.waitForSelector(".speech-title");
    if ((await page.title()) !== "Oracy")
      throw new Error("Unexpected document title");
    const applicationName = await desktop.evaluate(({ app }) => app.getName());
    if (applicationName !== "Oracy")
      throw new Error("Unexpected application name");
    await page.setViewportSize({ width: 1468, height: 854 });
    if (process.env.SPEECH_TEST_EXE) {
      await page.getByRole("button", { name: "生成本句", exact: true }).click();
      await page
        .locator(".pa-demo-track audio")
        .waitFor({ state: "attached", timeout: 120000 });
      await page
        .getByRole("button", { name: "播放 示范音频", exact: true })
        .click();
      await page.waitForFunction(
        () => document.querySelector(".pa-demo-track audio")?.currentTime > 0.1,
      );
      await page.getByRole("button", { name: "开始录音", exact: true }).click();
      await page.waitForTimeout(1200);
      await page.getByRole("button", { name: "停止录音", exact: true }).click();
      await page
        .locator(".pa-save-status")
        .filter({ hasText: "录音已保存" })
        .waitFor();
    }
    await capture("electron-practice.png");
    await page
      .getByRole("button", { name: "收起侧栏", exact: true })
      .click({ force: true });
    await page.waitForTimeout(220);
    await capture("electron-sidebar-collapsed.png");
    if (errors.length) throw new Error(errors.join("\n"));
    fs.writeFileSync(
      path.join(evidence, "electron-smoke.json"),
      JSON.stringify(
        {
          success: true,
          bridge: "Electron preload IPC",
          backend: "real isolated local backend",
          pageErrors: errors,
          title: await page.title(),
          applicationName,
          executable: process.env.SPEECH_TEST_EXE || "development Electron",
          packagedAudio: process.env.SPEECH_TEST_EXE
            ? "real Kokoro playback and virtual microphone save passed"
            : "not checked in development smoke",
        },
        null,
        2,
      ),
    );
    console.log(
      "Electron bridge, real backend, unified practice UI and sidebar: passed",
    );
  } finally {
    await desktop.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
