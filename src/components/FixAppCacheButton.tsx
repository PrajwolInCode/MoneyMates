import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { clearLocalAppCacheAndReload } from "../lib/appCache";
import { Button } from "./Button";
import { Toast } from "./Toast";

export function FixAppCacheButton() {
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFix = async () => {
    setClearing(true);
    setError(null);
    try {
      await clearLocalAppCacheAndReload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not clear the local app cache.");
      setClearing(false);
    }
  };

  return (
    <>
      {error ? <Toast message={error} tone="error" /> : null}
      <Button className="mt-4 w-full sm:w-auto" variant="secondary" loading={clearing} onClick={handleFix}>
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        Fix app loading issue
      </Button>
    </>
  );
}
