import { ChevronLeft, ChevronRight } from "lucide-react";
import { useHousehold } from "../contexts/HouseholdContext";
import { formatMonthLabel, monthInputToStart, monthStartToInput } from "../lib/date";
import { inputClass } from "./inputs";

export function MonthSelector() {
  const { monthStart, setSelectedMonth, goToNextMonth, goToPreviousMonth } = useHousehold();

  return (
    <div className="flex w-full items-center gap-2 sm:w-auto">
      <button
        type="button"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sage bg-white text-ink hover:border-moss"
        aria-label="Previous month"
        onClick={goToPreviousMonth}
      >
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      <label className="min-w-0 flex-1 sm:w-44 sm:flex-none">
        <span className="sr-only">Selected month</span>
        <input
          className={`${inputClass} min-h-11`}
          type="month"
          aria-label={formatMonthLabel(monthStart)}
          value={monthStartToInput(monthStart)}
          onChange={(event) => setSelectedMonth(monthInputToStart(event.target.value))}
        />
      </label>
      <button
        type="button"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sage bg-white text-ink hover:border-moss"
        aria-label="Next month"
        onClick={goToNextMonth}
      >
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}
