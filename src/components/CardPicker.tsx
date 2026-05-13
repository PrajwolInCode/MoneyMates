import { PAYMENT_CARDS } from "../lib/cards";
import { CardChip } from "./CardChip";

type CardPickerProps = {
  value: string | null;
  onChange: (cardId: string | null) => void;
  label?: string;
  helperText?: string;
};

export function CardPicker({ value, onChange, label = "Paid with", helperText }: CardPickerProps) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">{label}</p>
        {value ? (
          <button type="button" className="text-xs font-semibold text-moss hover:underline" onClick={() => onChange(null)}>
            Clear
          </button>
        ) : null}
      </div>
      {helperText ? <p className="mb-2 text-xs text-ink/55">{helperText}</p> : null}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        {PAYMENT_CARDS.map((card) => {
          const selected = value === card.id;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onChange(selected ? null : card.id)}
              aria-pressed={selected}
              className={`flex flex-col items-center gap-1.5 rounded-xl border bg-white px-2 py-2 transition ${
                selected ? "border-navy ring-2 ring-navy/30" : "border-sage hover:border-moss"
              }`}
            >
              <CardChip card={card} size="md" selected={selected} />
              <span className="truncate text-[11px] font-semibold text-ink/75">{card.shortName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
