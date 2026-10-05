import { type ReactNode, type CSSProperties, useRef, useId } from "react";
import { ChevronRight } from "lucide-react";

export type Tone =
  "neutral" | "blue" | "positive" | "warning" | "issue" | "violet";
export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`surface-panel ${className}`}>{children}</section>;
}
export function Toolbar({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`toolbar ${className}`}>{children}</div>;
}
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div
      className="segmented-control"
      role="tablist"
      aria-label={label}
      style={
        {
          "--segment-count": options.length,
          "--segment-index": Math.max(
            0,
            options.findIndex((option) => option.value === value),
          ),
        } as CSSProperties
      }
    >
      {options.map((option, i) => (
        <button
          key={option.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          role="tab"
          aria-selected={value === option.value}
          tabIndex={value === option.value ? 0 : -1}
          onClick={() => onChange(option.value)}
          onKeyDown={(e) => {
            let next: number;
            if (e.key === "ArrowRight") next = (i + 1) % options.length;
            else if (e.key === "ArrowLeft")
              next = (i + options.length - 1) % options.length;
            else if (e.key === "Home") next = 0;
            else if (e.key === "End") next = options.length - 1;
            else return;
            e.preventDefault();
            onChange(options[next].value);
            refs.current[next]?.focus();
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return <span className={`status-badge tone-${tone}`}>{children}</span>;
}
export function MetricCard({
  title,
  value,
  unit,
  detail,
  icon,
  tone = "blue",
}: {
  title: string;
  value: ReactNode;
  unit?: string;
  detail?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
}) {
  return (
    <Panel className={`metric-card tone-${tone}`}>
      {icon && <span className="metric-icon">{icon}</span>}
      <div>
        <span className="metric-label">{title}</span>
        <div
          className="metric-value"
          key={
            typeof value === "number" || typeof value === "string"
              ? String(value)
              : undefined
          }
        >
          {value}
          <small>{unit}</small>
        </div>
        {detail && <div className="metric-detail">{detail}</div>}
      </div>
    </Panel>
  );
}
export function ProgressRing({
  value,
  label,
  tone = "blue",
  suffix = "%",
}: {
  value: number;
  label: string;
  tone?: Tone;
  suffix?: string;
}) {
  const percent = Math.max(0, Math.min(100, value));
  const gradient = useId();
  return (
    <div className={`progress-ring tone-${tone}`} role="img" aria-label={label}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
            <stop
              offset="0%"
              stopColor="var(--tone-color)"
              stopOpacity="0.55"
            />
            <stop offset="100%" stopColor="var(--tone-color)" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="42" className="ring-track" />
        <circle
          cx="50"
          cy="50"
          r="42"
          className="ring-value"
          style={{
            opacity: percent === 0 ? 0 : 1,
            stroke: `url(#${gradient})`,
          }}
          pathLength="100"
          strokeDasharray={`${percent} 100`}
        />
      </svg>
      <strong>
        {Math.round(value)}
        <small>{suffix}</small>
      </strong>
    </div>
  );
}
export function CoachItem({
  title,
  status,
  advice,
  icon,
  tone = "neutral",
  disabled,
  quiet = false,
  visual,
  onClick,
}: {
  title: string;
  status: string;
  advice: string;
  icon: ReactNode;
  tone?: Tone;
  disabled?: boolean;
  quiet?: boolean;
  visual?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={`coach-item tone-${tone} ${quiet ? "is-unavailable" : ""}`}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="coach-icon">{icon}</span>
      <span className="coach-copy">
        <span className="coach-item-heading">
          <strong>{title}</strong>
          <StatusBadge tone={tone}>{status}</StatusBadge>
        </span>
        <span className="coach-advice">{advice}</span>
        {visual}
      </span>
      <ChevronRight size={17} />
    </button>
  );
}
