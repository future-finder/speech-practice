export function Brand({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  const asset = compact ? "mark" : "lockup";
  return (
    <span className={`brand-art ${compact ? "compact" : ""} ${className}`}>
      <img
        className="brand-light"
        src={`./brand/eloveris-${asset}-${compact ? "blue" : "color"}.svg`}
        alt="ELOVERIS"
      />
      <img
        className="brand-dark"
        src={`./brand/eloveris-${asset}-white.svg`}
        alt="ELOVERIS"
      />
    </span>
  );
}
