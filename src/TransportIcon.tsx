import { Pause, Play } from "lucide-react";
export function TransportIcon({
  playing,
  size = 18,
}: {
  playing: boolean;
  size?: number;
}) {
  return (
    <span
      className="transport-icon"
      data-playing={playing}
      aria-hidden="true"
      style={{ width: size, height: size }}
    >
      <Play className="play-symbol" size={size} fill="currentColor" />
      <Pause className="pause-symbol" size={size} fill="currentColor" />
    </span>
  );
}
