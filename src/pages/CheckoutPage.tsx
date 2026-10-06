import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, CreditCard, MapPin, ShoppingBag, Wallet } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format';
import { toUserMessage } from '@/lib/firebase/errors';
import { checkoutSchema, type CheckoutValues } from '@/lib/validation/schemas';
import { useAuth } from '@/context/AuthContext';
import { useAddresses } from '@/hooks/useAddresses';
import { useCart } from '@/context/CartContext';
import { placeOrder } from '@/services/orders';
import { fetchRestaurantById } from '@/services/restaurants';
import { Button } from '@/components/ui/Button';
import { Checkbox, Input } from '@/components/ui/Input';
import { Alert, Card, EmptyState, Spinner } from '@/components/ui/Primitives';
import { SampleAddressFields } from '@/components/checkout/SampleAddressFields';
import type { Address, PaymentMethod, Restaurant } from '@/types/models';

const EMPTY_ADDRESS: Omit<Address, 'id'> = {
  label: 'Home',
  line1: '',
  line2: '',
  city: '',
  postalCode: '',
  phone: '',
  isDefault: true,
};

/**
 * A fill-in-the-blank address for people trying the app out.
 *
 * Addresses live in a subcollection, so a brand-new account arrives at checkout
 * with an entirely blank form, and every field is required: without this the first
 * order ends on a page that looks broken rather than empty. Nothing is submitted
 * automatically - the fields are filled and the customer still presses "Place
 * order" - and the control disappears as soon as any field is touched, so it can
 * never overwrite an address someone is part-way through typing.
 */
const SAMPLE_ADDRESS = {
  phone: '98765 43210',
  line1: '42, MG Road',
  line2: 'Near Trinity Metro',
  city: 'Bengaluru',
  postalCode: '560001',
} as const;

const SAMPLE_ADDRESS_FIELDS = Object.keys(SAMPLE_ADDRESS) as Array<keyof typeof SAMPLE_ADDRESS>;

export function CheckoutPage() {
  const { cart, totals, isEmpty, clearCart } = useCart();
  const { user, profile } = useAuth();
  const { addresses: savedAddresses, defaultAddress } = useAddresses();
  const navigate = useNavigate();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loadingRestaurant, setLoadingRestaurant] = useState(true);
  const [restaurantError, setRestaurantError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    mode: 'onBlur',
    defaultValues: {
      address: { ...EMPTY_ADDRESS },
      paymentMethod: 'cod',
      saveAddress: true,
    },
  });

  // Re-read the restaurant at checkout: its delivery fee may have changed since
  // the item was added, and we must charge what is true *now*, not what was cached.
  useEffect(() => {
    if (!cart.restaurantId) {
      setLoadingRestaurant(false);
      return;
    }

    let cancelled = false;
    setLoadingRestaurant(true);

    fetchRestaurantById(cart.restaurantId)
      .then((result) => {
        if (cancelled) return;
        if (!result) setRestaurantError('This restaurant is no longer available.');
        else if (!result.isOpen) setRestaurantError('This restaurant has closed for the day.');
        else if (!result.isAcceptingOrders) {
          setRestaurantError('This restaurant has paused online orders.');
        } else setRestaurant(result);
      })
      .catch((error: unknown) => {
        if (!cancelled) setRestaurantError(toUserMessage(error));
      })
      .finally(() => {
        if (!cancelled) setLoadingRestaurant(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cart.restaurantId]);

  // Prefill from the saved default address. The list arrives via a live
  // listener, so this also covers a default added on the profile page.
  useEffect(() => {
    if (!user) return;

    if (defaultAddress) {
      reset((values) => ({
        ...values,
        address: {
          label: defaultAddress.label,
          line1: defaultAddress.line1,
          line2: defaultAddress.line2 ?? '',
          city: defaultAddress.city,
          postalCode: defaultAddress.postalCode,
          phone: defaultAddress.phone,
          isDefault: true,
        },
      }));
    } else if (profile?.phone) {
      setValue('address.phone', profile.phone, { shouldValidate: false });
    }
  }, [user, defaultAddress, profile?.phone, reset, setValue]);

  const paymentMethod = watch('paymentMethod');

  /*
   * True only while every box is still empty. Watched rather than read on demand
   * because the sample-address control has to disappear the moment someone starts
   * typing, not after they submit.
   */
  const addressValues = watch('address');
  const isAddressBlank = () =>
    SAMPLE_ADDRESS_FIELDS.every((field) => !String(addressValues[field] ?? '').trim());

  if (isEmpty) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={<ShoppingBag className="size-6" />}
          title="Nothing to check out"
          description="Your cart is empty. Add some dishes first."
          action={
            <Link to="/">
              <Button>Browse restaurants</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    if (!user || !restaurant) return;

    setPlacing(true);
    setFormError(null);

    try {
      const address: Address = {
        id: `addr_${Date.now()}`,
        label: values.address.label,
        line1: values.address.line1,
        line2: values.address.line2 || undefined,
        city: values.address.city,
        postalCode: values.address.postalCode,
        phone: values.address.phone,
        isDefault: values.address.isDefault,
      };

      const orderId = await placeOrder({
        userId: user.uid,
        userName: profile?.displayName ?? user.displayName ?? 'Foodhut user',
        userEmail: profile?.email ?? user.email ?? '',
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          deliveryFee: restaurant.deliveryFee,
        },
        lines: cart.lines,
        address,
        paymentMethod: values.paymentMethod as PaymentMethod,
      });

      // Persist for next time, after the order exists so nothing is lost if
      // the order write is the thing that fails.
      if (values.saveAddress) {
        const { saveAddress } = await import('@/services/auth');
        await saveAddress(user.uid, address).catch((error: unknown) => {
          // Non-fatal: the order is placed, the address just was not saved.
          console.warn('[checkout] could not save address', toUserMessage(error));
        });
      }

      clearCart();
      // Replace so the browser back button does not return to a dead checkout.
      navigate(`/orders?placed=${orderId}`, { replace: true });
    } catch (error) {
      setFormError(toUserMessage(error, 'Could not place your order. Please try again.'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setPlacing(false);
    }
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-ink-900 mb-6 text-xl font-bold tracking-tight sm:text-2xl">Checkout</h1>

      {restaurantError && (
        <Alert tone="danger" title="Cannot place this order" className="mb-5">
          {restaurantError}{' '}
          <Link to="/cart" className="font-semibold underline">
            Back to cart
          </Link>
        </Alert>
      )}

      {formError && (
        <Alert tone="danger" title="Order failed" className="mb-5">
          {formError}
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {/* Saved addresses */}
          {savedAddresses.length > 0 && (
            <Card className="p-5">
              <h2 className="text-ink-900 mb-3 text-sm font-bold">Deliver to a saved address</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {savedAddresses.map((address) => {
                  const selected =
                    watch('address.line1') === address.line1 &&
                    watch('address.postalCode') === address.postalCode;

                  return (
                    <button
                      key={address.id}
                      type="button"
                      onClick={() =>
                        reset((values) => ({
                          ...values,
                          address: {
                            label: address.label,
                            line1: address.line1,
                            line2: address.line2 ?? '',
                            city: address.city,
                            postalCode: address.postalCode,
                            phone: address.phone,
                            isDefault: address.isDefault,
                          },
                        }))
                      }
                      className={cn(
                        'flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors',
                        selected
                          ? 'border-brand-500 bg-brand-50'
                          : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50',
                      )}
                    >
                      <MapPin className="text-ink-400 mt-0.5 size-4 shrink-0" aria-hidden />
                      <span className="min-w-0">
                        <span className="text-ink-900 block text-sm font-semibold">
                          {address.label}
                        </span>
                        <span className="text-ink-500 mt-0.5 block text-xs">
                          {address.line1}, {address.city} {address.postalCode}
                        </span>
                      </span>
                      {selected && (
                        <Check className="text-brand-600 ml-auto size-4 shrink-0" aria-hidden />
                      )}
                    </button>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Delivery address */}
          <Card className="p-5">
            <h2 className="text-ink-900 mb-4 text-sm font-bold">Delivery address</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                {...register('address.label')}
                label="Label"
                placeholder="Home, Work…"
                error={errors.address?.label?.message}
                required
              />
              <Input
                {...register('address.phone')}
                label="Contact number"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="98765 43210"
                error={errors.address?.phone?.message}
                required
              />
              <Input
                {...register('address.line1')}
                label="Flat, house no., building"
                autoComplete="address-line1"
                placeholder="Flat 402, Green Residency"
                error={errors.address?.line1?.message}
                required
                className="sm:col-span-2"
                wrapperClassName="sm:col-span-2"
              />
              <Input
                {...register('address.line2')}
                label="Area, street, landmark (optional)"
                autoComplete="address-line2"
                placeholder="Near MG Road"
                error={errors.address?.line2?.message}
                wrapperClassName="sm:col-span-2"
              />
              <Input
                {...register('address.city')}
                label="City"
                autoComplete="address-level2"
                error={errors.address?.city?.message}
                required
              />
              <Input
                {...register('address.postalCode')}
                label="PIN code"
                inputMode="numeric"
                autoComplete="postal-code"
                placeholder="560001"
                error={errors.address?.postalCode?.message}
                required
              />
            </div>

            <div className="mt-4">
              <Checkbox
                {...register('address.isDefault')}
                label="Save this address for faster checkout next time"
              />
            </div>

            <SampleAddressFields
              empty={isAddressBlank()}
              onFill={() => {
                // Typed explicitly rather than with a template literal: the
                // resolver's field union is the only thing that keeps these keys
                // in step with the form, and a widened `address.${string}` would
                // silently pass typecheck.
                setValue('address.phone', SAMPLE_ADDRESS.phone);
                setValue('address.line1', SAMPLE_ADDRESS.line1);
                setValue('address.line2', SAMPLE_ADDRESS.line2);
                setValue('address.city', SAMPLE_ADDRESS.city);
                setValue('address.postalCode', SAMPLE_ADDRESS.postalCode);
                // Re-validate so the errors from the untouched empty form clear
                // immediately; otherwise the fields still show as invalid until
                // the next blur and the button appears not to have worked.
                void trigger('address');
              }}
            />
          </Card>

          {/* Payment */}
          <Card className="p-5">
            <h2 className="text-ink-900 mb-4 text-sm font-bold">Payment method</h2>
            <div className="space-y-2">
              <PaymentOption
                value="cod"
                selected={paymentMethod === 'cod'}
                icon={<Wallet className="size-4.5" aria-hidden />}
                title="Cash on delivery"
                description="Pay the delivery partner in cash"
              />
              <PaymentOption
                value="card_simulated"
                selected={paymentMethod === 'card_simulated'}
                icon={<CreditCard className="size-4.5" aria-hidden />}
                title="Card / UPI (demo)"
                description="Simulated payment — no real money moves"
              />
            </div>
            <p className="text-ink-400 mt-3 text-xs">
              This is a demo project. No payment gateway is connected, so no real transaction is
              ever processed.
            </p>
          </Card>

          <Button
            type="submit"
            size="lg"
            fullWidth
            loading={placing || isSubmitting}
            disabled={!restaurant || Boolean(restaurantError)}
          >
            {loadingRestaurant
              ? 'Verifying restaurant…'
              : `Place order · ${formatMoney(totals.total)}`}
          </Button>
        </form>

        {/* Summary */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            <h2 className="text-ink-900 text-sm font-bold">Order summary</h2>

            <div className="mt-4 max-h-56 space-y-2.5 overflow-y-auto pr-1">
              {cart.lines.map((line) => (
                <div
                  key={line.menuItemId}
                  className="flex items-start justify-between gap-2 text-sm"
                >
                  <span className="text-ink-600 min-w-0">
                    <span className="text-ink-800 font-medium">{line.quantity}×</span>{' '}
                    <span className="line-clamp-1">{line.name}</span>
                  </span>
                  <span className="text-ink-900 shrink-0 font-medium">
                    {formatMoney(line.unitPrice * line.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <dl className="border-ink-200 mt-4 space-y-2 border-t border-dashed pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-600">Item total</dt>
                <dd className="font-medium">{formatMoney(totals.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-600">Delivery fee</dt>
                <dd className="font-medium">
                  {totals.deliveryFee === 0 ? (
                    <span className="text-emerald-600">Free</span>
                  ) : (
                    formatMoney(totals.deliveryFee)
                  )}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-600">Taxes and charges</dt>
                <dd className="font-medium">{formatMoney(totals.tax)}</dd>
              </div>
              <div className="border-ink-200 flex justify-between border-t border-dashed pt-3 text-base">
                <dt className="font-bold">To pay</dt>
                <dd className="font-bold">{formatMoney(totals.total)}</dd>
              </div>
            </dl>

            {loadingRestaurant && (
              <p className="text-ink-500 mt-4 flex items-center gap-2 text-xs">
                <Spinner className="size-3.5" />
                Checking restaurant availability…
              </p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------ payment option ---------------------------- */

function PaymentOption({
  value,
  selected,
  icon,
  title,
  description,
}: {
  value: PaymentMethod;
  selected: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-colors',
        selected ? 'border-brand-500 bg-brand-50' : 'border-ink-200 hover:bg-ink-50',
      )}
    >
      <input
        type="radio"
        name="paymentMethod"
        value={value}
        checked={selected}
        className="accent-brand-600"
      />
      <span className={cn('shrink-0', selected ? 'text-brand-600' : 'text-ink-400')}>{icon}</span>
      <span className="min-w-0">
        <span className="text-ink-900 block text-sm font-semibold">{title}</span>
        <span className="text-ink-500 block text-xs">{description}</span>
      </span>
    </label>
  );
}
