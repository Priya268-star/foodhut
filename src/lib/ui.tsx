import { Spinner } from '@/components/ui/Primitives';

/** Centred, full-viewport loading state used while auth or a page resolves. */
export function fullPageSpinner(label: string) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <Spinner className="size-8" label={label} />
      <p className="text-ink-500 text-sm">{label}</p>
    </div>
  );
}

/** Page-level heading block. */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-ink-900 text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="text-ink-500 mt-1 text-sm">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
