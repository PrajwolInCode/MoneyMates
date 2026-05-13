import type { PaymentCard } from "../lib/cards";

type CardChipProps = {
  card: PaymentCard;
  size?: "xs" | "sm" | "md";
  selected?: boolean;
  showName?: boolean;
};

const SIZE_CLASSES = {
  xs: "h-5 w-8 text-[7px] leading-none rounded-[3px] px-1",
  sm: "h-7 w-11 text-[9px] leading-none rounded-md px-1.5",
  md: "h-10 w-16 text-[11px] leading-none rounded-lg px-2",
} as const;

export function CardChip({ card, size = "sm", selected = false, showName = false }: CardChipProps) {
  const sizeClass = SIZE_CLASSES[size];
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className={`relative inline-flex items-end justify-start font-bold tracking-tight shadow-sm ${sizeClass} ${selected ? "ring-2 ring-offset-1 ring-navy" : ""}`}
        style={{ backgroundColor: card.bg, color: card.fg }}
      >
        <span
          className="absolute right-0.5 top-0.5 inline-block rounded-[1px]"
          style={{
            width: size === "md" ? 10 : size === "sm" ? 7 : 5,
            height: size === "md" ? 7 : size === "sm" ? 5 : 4,
            backgroundColor: card.accent,
            opacity: 0.85,
          }}
        />
        <span className="relative z-[1] truncate">{card.shortName}</span>
      </span>
      {showName ? <span className="text-xs font-semibold text-ink/70">{card.name}</span> : null}
    </span>
  );
}
