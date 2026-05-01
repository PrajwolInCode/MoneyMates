import { CalendarDays, Trash2 } from "lucide-react";
import type { RecurringPayment } from "../types";
import { currency } from "../lib/format";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";

type RecurringListProps = {
  payments: RecurringPayment[];
  canManage?: boolean;
  onDelete?: (id: string) => void;
};

export function RecurringList({ payments, canManage, onDelete }: RecurringListProps) {
  if (!payments.length) {
    return <EmptyState icon={CalendarDays} title="No recurring payments yet" message="Add fixed payments like loans, insurance, or subscriptions." />;
  }

  return (
    <div className="divide-y divide-sage/70">
      {payments.map((payment) => (
        <div key={payment.id} className="flex items-center justify-between gap-3 py-3">
          <div>
            <p className="font-semibold text-ink">{payment.name}</p>
            <p className="text-sm text-ink/60">
              Due day {payment.due_day} · {payment.category?.name ?? "Category"} · {payment.cadence}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-ink">{currency(Number(payment.amount))}</p>
            {canManage && onDelete ? (
              <Button aria-label={`Delete ${payment.name}`} variant="ghost" className="h-10 w-10 px-0" onClick={() => onDelete(payment.id)}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
