import type { OrderStatus } from '@/types/models';

const MAP: Record<OrderStatus, { label: string; className: string }> = {
  placed: { label: 'New', className: 'bg-sky-100 text-sky-700' },
  confirmed: { label: 'Confirmed', className: 'bg-sky-100 text-sky-700' },
  preparing: { label: 'Preparing', className: 'bg-amber-100 text-amber-800' },
  out_for_delivery: { label: 'Out for delivery', className: 'bg-violet-100 text-violet-700' },
  delivered: { label: 'Delivered', className: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700' },
};

export function StatusPill({ status }: { status: OrderStatus }) {
  const { label, className } = MAP[status];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${className}`}>
      {label}
    </span>
  );
}
