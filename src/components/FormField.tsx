type FormFieldProps = {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
};

export function FormField({ label, error, hint, children }: FormFieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>
      {hint ? <span className="mb-1.5 block text-xs text-ink/55">{hint}</span> : null}
      {children}
      {error ? <span className="mt-1 block text-sm font-medium text-coral">{error}</span> : null}
    </label>
  );
}
