// Verifies native appearance storage across two fresh renderer origins/profiles.
const { _electron, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
(async () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "speech-appearance-desktop-"),
  );
  const evidence = path.resolve("docs/evidence/appearance");
  fs.mkdirSync(evidence, { recursive: true });
  const errors = [],
    connections = [];
  const launch = (profile) =>
    _electron.launch({
      executablePath: require("electron"),
      args: [".", `--user-data-dir=${path.join(root, profile)}`],
      env: { ...process.env, SPEECH_DATA_DIR: root, SPEECH_TEST_HIDDEN: "1" },
      timeout: 60000,
    });
  let desktop;
  const capture = async (name) => {
    await desktop.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
    await new Promise(resolve => setTimeout(resolve, 300));
    const png = await desktop.evaluate(async ({ BrowserWindow }) =>
      (
        await BrowserWindow.getAllWindows()[0].webContents.capturePage(
          undefined,
          { stayHidden: true, stayAwake: true },
        )
      )
        .toPNG()
        .toString("base64"),
    );
    fs.writeFileSync(path.join(evidence, name), Buffer.from(png, "base64"));
  };
  try {
    desktop = await launch("first-profile");
    let page = await desktop.firstWindow();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.locator(".welcome").waitFor();
    let connection = await page.evaluate(() => window.desktop.connection());
    connections.push(connection.base);
    await fetch(connection.base + "/api/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Appearance persistence",
        text: "We learn by listening carefully. A clear message begins with a thoughtful sentence.",
      }),
    });
    await page.evaluate(() => localStorage.setItem("language", "zh"));
    await page.reload();
    await page
      .getByRole("button", { name: "设置", exact: true })
      .click({ force: true });
    await page.getByLabel("开启装饰", { exact: true }).check({ force: true });
    await page
      .getByLabel("左下角素材导入图片", { exact: true })
      .setInputFiles(path.resolve("public/images/practice-botanical.png"));
    await expect(page.getByLabel("左下角素材", { exact: true })).toHaveValue(
      "custom",
    );
    await page.getByLabel("右上角素材", { exact: true }).selectOption("trace");
    await page.getByLabel("动效", { exact: true }).selectOption("reduced");
    const saved = await page.evaluate(() => window.desktop.visualPreferences());
    if (
      !saved.enabled ||
      saved.sidebar.asset !== "custom" ||
      saved.motion !== "reduced"
    )
      throw new Error("Native preference write failed");
    await desktop.close();
    desktop = null;
    desktop = await launch("second-profile");
    page = await desktop.firstWindow();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.locator(".speech-title").waitFor();
    await page.evaluate(() => localStorage.setItem("language", "zh"));
    await page.reload();
    connection = await page.evaluate(() => window.desktop.connection());
    connections.push(connection.base);
    await expect(page.locator(".botanical-edge")).toHaveAttribute(
      "data-asset",
      "custom",
    );
    await expect
      .poll(() =>
        page
          .locator(".botanical-edge .decor-material")
          .evaluate((e) => getComputedStyle(e).backgroundImage),
      )
      .toContain("blob:");
    await expect(page.locator("html")).toHaveAttribute(
      "data-motion",
      "reduced",
    );
    await page
      .locator(".botanical-edge .decor-material")
      .evaluate(async (e) => {
        const image = new Image();
        image.src = getComputedStyle(e).backgroundImage.slice(5, -2);
        await image.decode();
      });
    await capture("desktop-restored.png");
    await page
      .getByRole("button", { name: "设置", exact: true })
      .click({ force: true });
    await expect(page.getByLabel("左下角素材", { exact: true })).toHaveValue(
      "custom",
    );
    await expect(page.getByLabel("右上角素材", { exact: true })).toHaveValue(
      "trace",
    );
    await page.locator("#settings-appearance").waitFor();
    await page.waitForTimeout(200);
    // The IPC must reject path traversal; renderer never supplies a disk path.
    const rejected = await page.evaluate(async () => {
      try {
        await window.desktop.visualImage("get", "../preferences");
        return false;
      } catch {
        return true;
      }
    });
    if (!rejected || errors.length)
      throw new Error(
        "Bridge isolation or renderer check failed: " + errors.join("\n"),
      );
    await page
      .getByRole("button", { name: "恢复全部默认外观", exact: true })
      .click({ force: true });
    await expect(
      page.getByLabel("开启装饰", { exact: true }),
    ).not.toBeChecked();
    await expect
      .poll(
        () =>
          fs
            .readdirSync(path.join(root, "appearance"))
            .filter((name) => name.endsWith(".webp")).length,
      )
      .toBe(0);
    fs.writeFileSync(
      path.join(evidence, "desktop-persistence.json"),
      JSON.stringify(
        {
          success: true,
          independentRendererProfiles: true,
          connections,
          customRasterSavedAndRestored: true,
          resetRemovedImages: true,
          pathTraversalRejected: true,
          pageErrors: errors,
        },
        null,
        2,
      ),
    );
    console.log(
      "Electron appearance restart, custom image, reset and trusted IPC: passed",
    );
  } finally {
    if (desktop) await desktop.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
