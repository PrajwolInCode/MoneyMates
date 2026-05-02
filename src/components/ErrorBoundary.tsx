import { Component, type ErrorInfo, type ReactNode } from "react";
import { clearLocalAppCacheAndReload } from "../lib/appCache";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("MoneyMates crashed", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-mist px-4 py-10">
        <section className="w-full max-w-lg rounded-2xl border border-sage bg-white p-5 shadow-soft">
          <p className="text-sm font-semibold text-moss">App refresh needed</p>
          <h1 className="mt-2 text-2xl font-bold tracking-normal text-ink">MoneyMates needs a quick refresh</h1>
          <p className="mt-2 text-sm leading-6 text-ink/65">
            Your budget data is safe in Supabase. This device may have an old app cache.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white"
              onClick={() => void clearLocalAppCacheAndReload()}
            >
              Refresh app
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-sage bg-white px-4 py-2 text-sm font-semibold text-ink"
              onClick={() => void clearLocalAppCacheAndReload()}
            >
              Clear old app cache and reload
            </button>
          </div>
        </section>
      </main>
    );
  }
}
