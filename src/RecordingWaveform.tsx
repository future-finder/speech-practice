import { useEffect, useRef } from "react";

// Decorative only: sample the live microphone, never a timer or random values.
export function RecordingWaveform({
  stream,
  reducedMotion = false,
}: {
  stream: MediaStream | null;
  reducedMotion?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!stream) return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    let frame = 0;
    const draw = () => {
      const quiet = reducedMotion || preference.matches;
      analyser.getByteTimeDomainData(samples);
      const surface = canvas.current;
      const brush = surface?.getContext("2d");
      if (surface && brush) {
        brush.clearRect(0, 0, surface.width, surface.height);
        brush.fillStyle = getComputedStyle(surface).color;
        for (let bar = 0; bar < 24; bar++) {
          let amplitude = 0;
          for (let i = bar * 10; i < bar * 10 + 10; i++)
            amplitude = Math.max(amplitude, Math.abs(samples[i] - 128) / 128);
          const height = quiet ? 2 : Math.max(2, amplitude * 32);
          brush.fillRect(bar * 5, (32 - height) / 2, 3, height);
        }
      }
      if (!quiet) frame = requestAnimationFrame(draw);
    };
    const restart = () => {
      cancelAnimationFrame(frame);
      draw();
    };
    preference.addEventListener("change", restart);
    void context.resume().catch(() => {});
    draw();
    return () => {
      cancelAnimationFrame(frame);
      preference.removeEventListener("change", restart);
      source.disconnect();
      void context.close();
    };
  }, [stream, reducedMotion]);
  return (
    <canvas
      ref={canvas}
      width={120}
      height={32}
      className="record-waveform"
      aria-hidden="true"
    />
  );
}
