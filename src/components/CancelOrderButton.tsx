import { useState } from 'react';

import { cancelOrder } from '@/services/orders';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';

/** Cancel button with a confirmation step, so it cannot be hit by accident. */
export function CancelOrderButton({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onConfirm = async () => {
    setCancelling(true);
    setError(null);
    try {
      await cancelOrder(orderId);
      setOpen(false);
    } catch (err) {
      console.error('[orders] cancel failed', err);
      setError('Could not cancel this order. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} className="text-xs">
        Cancel order
      </Button>

      <ConfirmDialog
        open={open}
        title="Cancel this order?"
        message="The restaurant will be notified. This cannot be undone."
        confirmLabel={cancelling ? 'Cancelling…' : 'Yes, cancel it'}
        destructive
        onConfirm={() => void onConfirm()}
        onCancel={() => setOpen(false)}
      />

      {error && (
        <span role="alert" className="text-xs font-medium text-red-600">
          {error}
        </span>
      )}
    </>
  );
}
