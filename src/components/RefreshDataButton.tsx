import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "./Button";
import { Toast } from "./Toast";
import { useHousehold } from "../contexts/HouseholdContext";

type RefreshDataButtonProps = {
  className?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

function messageFromError(caught: unknown) {
  return caught instanceof Error ? caught.message : "Data could not be loaded.";
}

export function RefreshDataButton({ className, variant = "secondary" }: RefreshDataButtonProps) {
  const { refresh } = useHousehold();
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!toast && !error) return;
    const timeout = window.setTimeout(() => {
      setToast(null);
      setError(null);
    }, 2800);
    return () => window.clearTimeout(timeout);
  }, [error, toast]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setToast(null);
    setError(null);
    try {
      await refresh({ throwOnError: true, clearNotifications: true });
      setToast("Data refreshed and notifications cleared");
    } catch (caught) {
      setError(messageFromError(caught));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <>
      {toast ? <Toast message={toast} /> : null}
      {error ? <Toast message={error} tone="error" /> : null}
      <Button className={className} variant={variant} loading={refreshing} onClick={handleRefresh}>
        {refreshing ? null : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
        {refreshing ? "Refreshing your household data..." : "Refresh data"}
      </Button>
    </>
  );
}
