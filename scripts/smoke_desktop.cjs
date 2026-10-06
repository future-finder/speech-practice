// Exercise the packaged Electron application, using a virtual microphone.
const { _electron: electron } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
async function main() {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), "演讲练习-"));
  fs.writeFileSync(
    path.join(data, "settings.json"),
    JSON.stringify({
      model_dir: path.join(
        process.env.LOCALAPPDATA,
        "speech-practice",
        "models",
      ),
    }),
  );
  const executable =
    process.env.SPEECH_TEST_EXE ||
    path.resolve("release/win-unpacked/ELOVERIS.exe");
  const application = await electron.launch({
    executablePath: executable,
    args: [
      "--user-data-dir=" + path.join(data, "electron-profile"),
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
    env: {
      ...process.env,
      SPEECH_DATA_DIR: data,
      SPEECH_TEST_HIDDEN: "1",
      PATH: path.join(process.env.SystemRoot, "System32"),
      VIRTUAL_ENV: "",
      PYTHONPATH: "",
      HTTP_PROXY: "http://127.0.0.1:9",
      HTTPS_PROXY: "http://127.0.0.1:9",
      NO_PROXY: "127.0.0.1",
    },
    timeout: 120000,
  });
  const results = [];
  let connection;
  try {
    const page = await application.firstWindow();
    connection = await page.evaluate(() => window.desktop.connection());
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.waitForLoadState("domcontentloaded");
    await page.evaluate(() => localStorage.setItem("language", "en"));
    await page.reload();
    await page
      .locator(".welcome")
      .getByRole("button", { name: "New speech", exact: true })
      .click();
    await page.getByLabel("Title", { exact: true }).fill("A clearer voice");
    await page
      .getByLabel("English speech", { exact: true })
      .fill(
        "Every meaningful change begins with a small decision. We choose to listen more carefully.",
      );
    await page
      .getByRole("button", { name: "Create practice", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Generate all", exact: true })
      .click();
    await page.waitForFunction(
      () => document.querySelectorAll("audio").length > 0,
      {},
      { timeout: 120000 },
    );
    results.push({ step: "packaged_tts_and_audio_element", status: "passed" });
    await page
      .locator(".audio-with-save audio")
      .evaluate((element) => element.play());
    await page.waitForFunction(
      () => {
        const audio = document.querySelector(".audio-with-save audio");
        return audio && audio.currentTime > 0;
      },
      {},
      { timeout: 15000 },
    );
    const playback = await page
      .locator(".audio-with-save audio")
      .evaluate((element) => element.currentTime);
    if (playback <= 0)
      throw new Error("Packaged audio playback did not advance");
    await page
      .locator(".audio-with-save audio")
      .evaluate((element) => element.pause());
    results.push({
      step: "packaged_audio_playback",
      status: "passed",
      time: playback,
    });
    await page
      .getByRole("button", { name: "Start recording", exact: true })
      .click();
    await page.waitForTimeout(1300);
    await page
      .getByRole("button", { name: "Stop recording", exact: true })
      .click();
    await page.getByText("Recording saved.", { exact: false }).waitFor();
    results.push({
      step: "packaged_virtual_microphone_upload",
      status: "passed",
    });
    const target = path.resolve("docs/evidence/桌面录音.wav");
    await application.evaluate(({ dialog }, target) => {
      dialog.showSaveDialog = async () => ({
        canceled: false,
        filePath: target,
      });
    }, target);
    await page.getByRole("button", { name: "Download recording" }).click();
    for (let i = 0; i < 30 && !fs.existsSync(target); i++)
      await page.waitForTimeout(100);
    if (fs.readFileSync(target).subarray(0, 4).toString() !== "RIFF")
      throw new Error("Native save did not produce WAV");
    results.push({ step: "native_save_wav", status: "passed" });
    await page
      .getByRole("button", { name: "Check transcript", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Transcript differences", exact: true })
      .waitFor({ timeout: 120000 });
    results.push({ step: "packaged_asr_virtual_input", status: "passed" });
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByLabel("Pronunciation provider").selectOption("tencent");
    await page.waitForFunction(async () => {
      const c = await window.desktop.connection();
      const r = await fetch(c.base + "/api/settings", {
        headers: { Authorization: "Bearer " + c.token },
      });
      return (await r.json()).pronunciation_provider === "tencent";
    });
    await page.screenshot({
      path: "docs/evidence/asr-0.2/provider-settings.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Close", exact: true })
      .last()
      .click();
    page.once("dialog", async (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Assess pronunciation", exact: true })
      .click();
    await page
      .locator(".assessment-panel")
      .filter({ hasText: "not_configured" })
      .waitFor({ timeout: 30000 });
    results.push({
      step: "packaged_tencent_disabled_feedback_history",
      status: "passed",
      online_verified: false,
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.reload();
    await page.locator(".snapshot").waitFor();
    results.push({ step: "reload_restores_history", status: "passed" });
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(JSON.stringify(results));
  } finally {
    await application.close();
    if (connection) {
      let stillListening = true;
      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          await fetch(connection.base, { signal: AbortSignal.timeout(1000) });
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch {
          stillListening = false;
          break;
        }
      }
      results.push({
        step: "backend_stops_after_desktop_exit",
        status: stillListening ? "failed" : "passed",
      });
      if (stillListening) process.exitCode = 1;
    }
    fs.writeFileSync(
      "docs/evidence/desktop-smoke.json",
      JSON.stringify(
        {
          data,
          executable,
          results,
          limitations: [
            "Virtual microphone, not physical microphone",
            "Native save dialog selected by test harness",
            "Not a clean Windows VM",
          ],
        },
        null,
        2,
      ),
    );
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
