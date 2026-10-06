import { Wand2 } from 'lucide-react';

import { Button } from '@/components/ui/Button';

interface SampleAddressFieldsProps {
  /** True only while every address box is still empty. */
  empty: boolean;
  onFill: () => void;
}

/**
 * "Use a sample address" shortcut for a checkout form that has just been reached
 * for the first time.
 *
 * It is shown *only* while the form is untouched rather than being a permanent
 * extra control, for two reasons: it is a convenience for a demo, not part of
 * ordering, so it should not sit under a real address permanently; and it must
 * never be able to overwrite what someone is in the middle of typing.
 */
export function SampleAddressFields({ empty, onFill }: SampleAddressFieldsProps) {
  if (!empty) return null;

  return (
    <div className="border-brand-200 bg-brand-50/60 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed px-3.5 py-3">
      <p className="text-ink-600 text-xs">
        First time here? Fill a sample address so you can try placing an order.
      </p>
      <Button type="button" size="sm" variant="outline" onClick={onFill}>
        <Wand2 className="size-3.5" aria-hidden />
        Use sample address
      </Button>
    </div>
  );
}