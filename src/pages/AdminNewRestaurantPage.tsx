import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { cn } from '@/lib/cn';
import { toUserMessage } from '@/lib/firebase/errors';
import { useAuth } from '@/context/AuthContext';
import { createRestaurant } from '@/services/admin';
import { uploadImage, validateImageFile } from '@/services/uploads';
import { Button } from '@/components/ui/Button';
import { Checkbox, Input, Textarea } from '@/components/ui/Input';
import { Alert, Card } from '@/components/ui/Primitives';
import { SmartImage } from '@/components/ui/SmartImage';
import { PRICE_LEVELS, type PriceLevel } from '@/types/models';

const CUISINES = [
  'North Indian',
  'South Indian',
  'Chinese',
  'Fast Food',
  'Pizza',
  'Burgers',
  'Biryani',
  'Desserts',
  'Bakery',
  'Healthy',
  'Mughlai',
  'Seafood',
  'Vegan',
  'Biryani & Kebab',
] as const;

/** Owner-facing restaurant form. Delivery fee is entered in rupees. */
const restaurantFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(80, 'Keep it under 80 characters'),
  description: z
    .string()
    .trim()
    .min(10, 'Describe the restaurant in at least 10 characters')
    .max(500, 'Keep it under 500 characters'),
  area: z.string().trim().min(2, 'Area is required').max(80),
  city: z.string().trim().min(2, 'City is required').max(60),
  deliveryTimeMinutes: z.coerce
    .number('Enter the delivery time in minutes')
    .int('Enter whole minutes')
    .min(10, 'Minimum 10 minutes')
    .max(180, 'Maximum 180 minutes'),
  deliveryFee: z.coerce
    .number('Enter a delivery fee')
    .min(0, 'Fee cannot be negative')
    .max(50000, 'Fee looks too high'),
  priceLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  isOpen: z.boolean(),
  isAcceptingOrders: z.boolean(),
  isFeatured: z.boolean(),
});

type RestaurantFormValues = z.infer<typeof restaurantFormSchema>;

const LABELS = {
  name: 'Restaurant name',
  description: 'Description',
} as const;

export function AdminNewRestaurantPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [imageUrl, setImageUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [uploading, setUploading] = useState<'image' | 'cover' | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof restaurantFormSchema>, unknown, RestaurantFormValues>({
    // Three generics because `z.coerce` means the form input (strings from
    // `register`) and the parsed output (numbers) have different types.
    resolver: zodResolver(restaurantFormSchema),
    defaultValues: {
      name: '',
      description: '',
      area: '',
      city: 'Bengaluru',
      deliveryTimeMinutes: 30,
      deliveryFee: 40,
      priceLevel: 2 as PriceLevel,
      isOpen: true,
      isAcceptingOrders: true,
      isFeatured: false,
    },
  });

  const priceLevel = watch('priceLevel');

  const upload = async (file: File | undefined, kind: 'image' | 'cover') => {
    if (!file || !user) return;

    const validation = validateImageFile(file);
    if (!validation.ok) {
      setUploadError(validation.error ?? 'Invalid image.');
      return;
    }

    setUploading(kind);
    setUploadError(null);
    try {
      const url = await uploadImage(file, {
        ownerId: user.uid,
        scope: 'restaurants',
        entityId: 'profile',
        fileName: file.name,
      });
      if (kind === 'image') setImageUrl(url);
      else setCoverUrl(url);
    } catch (error) {
      setUploadError(toUserMessage(error, 'Upload failed.'));
    } finally {
      setUploading(null);
    }
  };

  const submit = handleSubmit(async (values: RestaurantFormValues) => {
    if (!user) return;
    setSubmitError(null);

    try {
      /*
       * One write. Ownership is stamped from the caller's auth token by
       * `createRestaurant`, and the rules verify it — there is no second
       * write to a profile, so there is nothing to keep in sync and nothing
       * to fail halfway. `isOwner` in AuthContext updates from the live query.
       */
      const id = await createRestaurant({
        name: values.name,
        description: values.description,
        cuisines: selectedCuisines,
        imageUrl: imageUrl || FALLBACK_IMAGE,
        coverImageUrl: coverUrl || imageUrl || null,
        deliveryTimeMinutes: values.deliveryTimeMinutes,
        // The form takes rupees; the domain model stores paise.
        deliveryFee: Math.round(values.deliveryFee * 100),
        priceLevel: values.priceLevel,
        location: { area: values.area, city: values.city },
        isOpen: values.isOpen,
        isAcceptingOrders: values.isAcceptingOrders,
        isFeatured: values.isFeatured,
      });

      navigate(`/admin/restaurants/${id}/menu`, { replace: true });
    } catch (error) {
      setSubmitError(toUserMessage(error, 'Could not create this restaurant.'));
    }
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-ink-900 mb-1 text-xl font-bold tracking-tight sm:text-2xl">
        Add a restaurant
      </h1>
      <p className="text-ink-500 mb-6 text-sm">It goes live as soon as you add its first dish.</p>

      {submitError && (
        <Alert tone="danger" title="Could not create restaurant" className="mb-5">
          {submitError}
        </Alert>
      )}

      <form onSubmit={submit} noValidate className="space-y-5">
        <Card className="p-5">
          <h2 className="text-ink-900 mb-4 text-sm font-bold">Basics</h2>

          {uploadError && (
            <Alert tone="danger" className="mb-4">
              {uploadError}
            </Alert>
          )}

          <div className="mb-5 grid gap-4 sm:grid-cols-2">
            <ImagePicker
              label="Logo"
              value={imageUrl}
              uploading={uploading === 'image'}
              onPick={(file) => void upload(file, 'image')}
              onClear={() => setImageUrl('')}
            />
            <ImagePicker
              label="Cover photo"
              value={coverUrl}
              uploading={uploading === 'cover'}
              onPick={(file) => void upload(file, 'cover')}
              onClear={() => setCoverUrl('')}
              wide
            />
          </div>

          <div className="space-y-4">
            <Input
              {...register('name')}
              label={LABELS.name}
              placeholder="Truffle Affairs"
              error={errors.name?.message}
              required
            />
            <Textarea
              {...register('description')}
              label={LABELS.description}
              rows={3}
              placeholder="Wood-fired pizzas, hand-made pastas and fresh desserts."
              error={errors.description?.message}
              required
            />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-ink-900 mb-3 text-sm font-bold">Cuisines</h2>
          <p className="text-ink-500 mb-3 text-xs">Pick every cuisine you serve.</p>
          <div className="flex flex-wrap gap-2">
            {CUISINES.map((cuisine) => {
              const selected = selectedCuisines.includes(cuisine);
              return (
                <button
                  key={cuisine}
                  type="button"
                  onClick={() =>
                    setSelectedCuisines((current) =>
                      current.includes(cuisine)
                        ? current.filter((c) => c !== cuisine)
                        : [...current, cuisine],
                    )
                  }
                  aria-pressed={selected}
                  className={cn(
                    'rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors',
                    selected
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-ink-200 text-ink-700 hover:bg-ink-50',
                  )}
                >
                  {cuisine}
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-ink-900 mb-4 text-sm font-bold">Location & delivery</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              {...register('area')}
              label="Area / locality"
              placeholder="Indiranagar"
              error={errors.area?.message}
              required
            />
            <Input {...register('city')} label="City" error={errors.city?.message} required />
            <Input
              {...register('deliveryTimeMinutes')}
              label="Delivery time (minutes)"
              type="number"
              min={10}
              max={180}
              error={errors.deliveryTimeMinutes?.message}
              hint="Shown to customers"
            />
            <Input
              {...register('deliveryFee')}
              label="Delivery fee"
              inputMode="decimal"
              leadingIcon={<span className="text-sm font-bold">₹</span>}
              hint="Enter 0 for free delivery"
              error={errors.deliveryFee?.message}
            />
          </div>

          <div className="mt-5">
            <span className="text-ink-800 mb-2 block text-sm font-medium">Price level</span>
            <div className="flex gap-2">
              {PRICE_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setValue('priceLevel', level, { shouldDirty: true })}
                  aria-pressed={priceLevel === level}
                  className={cn(
                    'h-10 flex-1 rounded-xl border text-sm font-semibold transition-colors',
                    priceLevel === level
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-ink-200 text-ink-700 hover:bg-ink-50',
                  )}
                >
                  {'₹'.repeat(level)}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <Checkbox {...register('isOpen')} label="Accepting orders right now" />
            <Checkbox
              {...register('isFeatured')}
              label="Feature this restaurant on the home page"
            />
          </div>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" size="lg" loading={isSubmitting}>
            Create restaurant
          </Button>
          <Button type="button" size="lg" variant="ghost" onClick={() => navigate('/admin')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

/* -------------------------------- fragments ------------------------------- */

/**
 * Used when an owner creates a restaurant without uploading a logo. A local
 * branded card is used rather than an external URL, so a new restaurant never
 * points at a photo we have not checked.
 */
const FALLBACK_IMAGE = '/dishes/cover-healthy-bowl.svg';

export function ImagePicker({
  label,
  value,
  uploading,
  onPick,
  onClear,
  wide = false,
}: {
  label: string;
  value: string;
  uploading: boolean;
  onPick: (file: File | undefined) => void;
  onClear: () => void;
  wide?: boolean;
}) {
  return (
    <div className={cn('min-w-0', wide && 'sm:col-span-1')}>
      <span className="text-ink-800 mb-1.5 block text-sm font-medium">{label}</span>

      {value ? (
        <div className="relative inline-block">
          <SmartImage
            src={value}
            alt={`${label} preview`}
            aspect="aspect-[4/3]"
            className="border-ink-200 w-32 rounded-xl border"
          />
          <button
            type="button"
            onClick={onClear}
            aria-label={`Remove ${label}`}
            className="bg-ink-800 hover:bg-ink-900 absolute -top-2 -right-2 rounded-full p-1.5 text-white shadow-md transition-colors"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      ) : (
        <label
          className={cn(
            'flex h-28 w-32 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed',
            'border-ink-300 text-ink-500 hover:border-brand-400 hover:bg-brand-50/40 transition-colors',
            uploading && 'pointer-events-none opacity-60',
          )}
        >
          {uploading ? (
            <Loader2 className="text-brand-600 size-5 animate-spin" aria-hidden />
          ) : (
            <ImagePlus className="size-5" aria-hidden />
          )}
          <span className="text-xs font-semibold">{uploading ? 'Uploading…' : 'Upload'}</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="sr-only"
            onChange={(event) => onPick(event.target.files?.[0])}
          />
        </label>
      )}
    </div>
  );
}
