import clsx from "clsx";

type ProgressBarProps = {
  value: number;
};

export function ProgressBar({ value }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-sage">
      <div
        className={clsx("h-full rounded-full transition-all", clamped >= 100 ? "bg-coral" : clamped >= 80 ? "bg-gold" : "bg-moss")}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
