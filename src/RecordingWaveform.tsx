import { useEffect, useRef, useState } from "react";

/** Observes the existing capture stream; never requests or stops microphone tracks. */
export function RecordingWaveform({
  stream,
  recording,
  lang,
}: {
  stream: MediaStream | null;
  recording: boolean;
  lang: "zh" | "en";
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    history = useRef<number[]>([]);
  const [state, setState] = useState<"idle" | "live" | "held" | "unavailable">(
    "idle",
  );
  useEffect(() => {
    if (!recording || !stream) {
      setState((s) => (s === "live" ? "held" : s));
      return;
    }
    let context: AudioContext | undefined,
      frame = 0,
      stopped = false,
      last = 0;
    history.current = [];
    const draw = (values: number[]) => {
      const c = canvas.current,
        ctx = c?.getContext("2d");
      if (!c || !ctx) return;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.strokeStyle = getComputedStyle(c).getPropertyValue("--pa-coral").trim() || "#d55c69";
      ctx.lineWidth = 2;
      values.forEach((peak, i) => {
        const x = (i / 120) * c.width + 1,
          half = Math.max(0.6, peak * 22);
        ctx.beginPath();
        ctx.moveTo(x, 24 - half);
        ctx.lineTo(x, 24 + half);
        ctx.stroke();
      });
    };
    void (async () => {
      try {
        context = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        context.createMediaStreamSource(stream).connect(analyser);
        await context.resume();
        if (stopped) return;
        setState("live");
        const samples = new Float32Array(analyser.fftSize);
        const tick = (time: number) => {
          if (stopped) return;
          if (time - last >= 50) {
            last = time;
            analyser.getFloatTimeDomainData(samples);
            let peak = 0;
            for (const sample of samples)
              peak = Math.max(peak, Math.abs(sample));
            history.current.push(peak);
            if (history.current.length > 120) history.current.shift();
            draw(history.current);
          }
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      } catch {
        if (!stopped) setState("unavailable");
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      if (context && context.state !== "closed") void context.close();
    };
  }, [stream, recording]);
  return (
    <div
      className={`live-waveform ${state === "idle" ? "is-empty" : ""}`}
      data-state={state}
    >
      <canvas ref={canvas} width="360" height="48" aria-hidden="true" />
      <span>
        {state === "live"
          ? lang === "zh"
            ? "正在录音"
            : "Recording"
          : state === "unavailable"
            ? lang === "zh"
              ? "实时波形不可用；录音继续"
              : "Live waveform unavailable; recording continues"
            : state === "held"
              ? lang === "zh"
                ? "录音已停止"
                : "Recording stopped"
              : ""}
      </span>
    </div>
  );
}
