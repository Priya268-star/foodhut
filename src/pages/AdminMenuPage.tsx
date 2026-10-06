import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChefHat, ImagePlus, Loader2, Plus, Trash2, UtensilsCrossed, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { cn } from '@/lib/cn';
import { paiseToRupees, formatMoney } from '@/lib/format';
import { toUserMessage } from '@/lib/firebase/errors';
import { menuItemSchema, type MenuItemValues } from '@/lib/validation/schemas';
import { useAuth } from '@/context/AuthContext';
import {
  createMenuItem,
  deleteMenuItem,
  subscribeToManagedRestaurants,
  updateMenuItem,
} from '@/services/admin';
import { fetchAllMenuItems, groupMenuByCategory } from '@/services/menu';
import { uploadImage, validateImageFile } from '@/services/uploads';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { SmartImage } from '@/components/ui/SmartImage';
import { Alert, Badge, Card, EmptyState, Spinner } from '@/components/ui/Primitives';
import type { MenuItem, Restaurant } from '@/types/models';

export function AdminMenuPage() {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const { user, isAdmin } = useAuth();

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToManagedRestaurants(user.uid, isAdmin, {
      onChange: (next) => {
        setRestaurants(next);
        setLoading(false);
      },
      onError: (message) => {
        setError(message);
        setLoading(false);
      },
    });

    return unsubscribe;
  }, [user, isAdmin]);

  // A URL id we do not own must not be selectable — fall back to the first one.
  useEffect(() => {
    if (restaurants.length === 0) return;
    const owned = restaurantId ? restaurants.some((r) => r.id === restaurantId) : false;
    if (!owned) {
      const first = restaurants[0];
      if (first) {
        window.history.replaceState(null, '', `/admin/restaurants/${first.id}/menu`);
      }
    }
  }, [restaurants, restaurantId]);

  const activeId = restaurantId ?? restaurants[0]?.id;

  useEffect(() => {
    if (!activeId) {
      setItems([]);
      return;
    }
    let cancelled = false;

    fetchAllMenuItems(activeId)
      .then((next) => {
        if (!cancelled) setItems(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(toUserMessage(err));
      });

    return () => {
      cancelled = true;
    };
  }, [activeId]);

  const toggleAvailability = async (item: MenuItem) => {
    if (!activeId) return;

    // Optimistic: flip locally, then reconcile with the server response.
    const previous = items;
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, isAvailable: !entry.isAvailable } : entry,
      ),
    );
    try {
      await updateMenuItem(activeId, item.id, { isAvailable: !item.isAvailable });
    } catch (err) {
      setItems(previous);
      setError(toUserMessage(err, 'Could not update availability.'));
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="size-6" label="Loading your restaurants" />
      </div>
    );
  }

  if (restaurants.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={<ChefHat className="size-6" />}
          title="No restaurants yet"
          description="Create your first restaurant from the dashboard, then add dishes to its menu."
          action={
            <Link to="/admin">
              <Button>Go to dashboard</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-ink-900 text-xl font-bold tracking-tight sm:text-2xl">Menu</h1>
          <p className="text-ink-500 mt-1 text-sm">
            {items.length} dish{items.length === 1 ? '' : 'es'}
          </p>
        </div>

        <Button
          onClick={() => {
            setEditingItem(null);
            setEditorOpen(true);
          }}
          leadingIcon={<Plus className="size-4" />}
        >
          Add dish
        </Button>
      </div>

      {restaurants.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {restaurants.map((restaurant) => (
            <Link
              key={restaurant.id}
              to={`/admin/restaurants/${restaurant.id}/menu`}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors',
                restaurant.id === activeId
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-ink-200 text-ink-700 hover:bg-ink-50',
              )}
            >
              {restaurant.name}
            </Link>
          ))}
        </div>
      )}

      {error && (
        <Alert tone="danger" className="mb-5">
          {error}
        </Alert>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={<UtensilsCrossed className="size-6" />}
          title="No dishes yet"
          description="Add your first dish and it will appear on your restaurant page instantly."
          action={
            <Button
              onClick={() => {
                setEditingItem(null);
                setEditorOpen(true);
              }}
              leadingIcon={<Plus className="size-4" />}
            >
              Add your first dish
            </Button>
          }
        />
      ) : (
        <div className="space-y-8">
          {groupMenuByCategory(items).map((group) => (
            <section key={group.category}>
              <h2 className="text-ink-500 mb-3 text-sm font-bold uppercase">{group.category}</h2>
              <ul className="space-y-3">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <Card className="flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap">
                      <SmartImage
                        src={item.imageUrl}
                        alt=""
                        aspect="aspect-square"
                        className="size-16 shrink-0 rounded-xl"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-ink-900 font-bold">{item.name}</h3>
                          {!item.isAvailable && <Badge tone="danger">Unavailable</Badge>}
                        </div>
                        <p className="text-ink-700 mt-0.5 text-sm font-semibold">
                          {formatMoney(item.price)}
                        </p>
                        <p className="text-ink-500 mt-0.5 line-clamp-1 text-xs">
                          {item.description}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          size="sm"
                          variant={item.isAvailable ? 'ghost' : 'outline'}
                          onClick={() => void toggleAvailability(item)}
                        >
                          {item.isAvailable ? 'Hide' : 'Show'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingItem(item);
                            setEditorOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => setDeleteTarget(item)}
                          aria-label={`Delete ${item.name}`}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <MenuItemEditor
        open={editorOpen}
        restaurantId={activeId ?? ''}
        item={editingItem}
        onClose={() => {
          setEditorOpen(false);
          setEditingItem(null);
        }}
        onSaved={async () => {
          setEditorOpen(false);
          setEditingItem(null);
          if (activeId) setItems(await fetchAllMenuItems(activeId));
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this dish?"
        message={`"${deleteTarget?.name ?? ''}" will be permanently removed from your menu.`}
        confirmLabel="Delete dish"
        destructive
        onConfirm={() => {
          if (deleteTarget && activeId) {
            void deleteMenuItem(activeId, deleteTarget.id)
              .then(async () => setItems(await fetchAllMenuItems(activeId)))
              .catch((err: unknown) => setError(toUserMessage(err)))
              .finally(() => setDeleteTarget(null));
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

/* ------------------------------- item editor ------------------------------ */

function MenuItemEditor({
  open,
  restaurantId,
  item,
  onClose,
  onSaved,
}: {
  open: boolean;
  restaurantId: string;
  item: MenuItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<MenuItemValues>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: {
      name: '',
      description: '',
      price: '',
      category: '',
      imageUrl: '',
      isVeg: false,
      isAvailable: true,
      sortOrder: 0,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (item) {
      reset({
        name: item.name,
        description: item.description,
        price: String(paiseToRupees(item.price)),
        category: item.category,
        imageUrl: item.imageUrl,
        isVeg: item.isVeg,
        isAvailable: item.isAvailable,
        sortOrder: item.sortOrder,
      });
      setImageUrl(item.imageUrl);
    } else {
      reset({
        name: '',
        description: '',
        price: '',
        category: '',
        imageUrl: '',
        isVeg: false,
        isAvailable: true,
        sortOrder: 0,
      });
      setImageUrl('');
    }
    setUploadError(null);
    setSaveError(null);
    setUploadPercent(0);
  }, [open, item, reset]);

  const isVeg = watch('isVeg');
  const isAvailable = watch('isAvailable');

  const onPickImage = async (file: File | undefined) => {
    if (!file || !user) return;

    const validation = validateImageFile(file);
    if (!validation.ok) {
      setUploadError(validation.error ?? 'Invalid image.');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadPercent(0);

    try {
      const url = await uploadImage(
        file,
        {
          ownerId: user.uid,
          scope: 'menu',
          entityId: restaurantId,
          fileName: file.name,
        },
        setUploadPercent,
      );
      setImageUrl(url);
      setValue('imageUrl', url, { shouldValidate: false });
    } catch (error) {
      setUploadError(toUserMessage(error, 'Upload failed. Please try again.'));
    } finally {
      setUploading(false);
    }
  };

  const submit = handleSubmit(async (values) => {
    setSaving(true);
    setSaveError(null);
    try {
      const draft = {
        restaurantId,
        name: values.name,
        description: values.description,
        price: Math.round(Number.parseFloat(values.price.replace(/[^\d.]/g, '')) * 100),
        imageUrl: imageUrl || values.imageUrl,
        category: values.category,
        isVeg: values.isVeg,
        isAvailable: values.isAvailable,
        sortOrder: Number(values.sortOrder) || 0,
        rating: 0,
        ratingCount: 0,
      };

      if (item) await updateMenuItem(restaurantId, item.id, draft);
      else await createMenuItem(restaurantId, draft);

      onSaved();
    } catch (error) {
      setSaveError(toUserMessage(error, 'Could not save this dish.'));
    } finally {
      setSaving(false);
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? 'Edit dish' : 'Add a new dish'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            {item ? 'Save changes' : 'Add dish'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {saveError && <Alert tone="danger">{saveError}</Alert>}
        {uploadError && <Alert tone="danger">{uploadError}</Alert>}

        {/* Image picker */}
        <div>
          <span className="text-ink-800 mb-1.5 block text-sm font-medium">Dish photo</span>

          {imageUrl ? (
            <div className="relative inline-block">
              <SmartImage
                src={imageUrl}
                alt="Dish preview"
                aspect="aspect-square"
                className="border-ink-200 size-32 rounded-xl border"
              />
              <button
                type="button"
                onClick={() => {
                  setImageUrl('');
                  setValue('imageUrl', '', { shouldValidate: false });
                }}
                aria-label="Remove image"
                className="bg-ink-800 hover:bg-ink-900 absolute -top-2 -right-2 rounded-full p-1.5 text-white shadow-md transition-colors"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          ) : (
            <label
              className={cn(
                'flex h-32 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed',
                'border-ink-300 text-ink-500 hover:border-brand-400 hover:bg-brand-50/40 transition-colors',
                'focus-within:border-brand-500',
                uploading && 'pointer-events-none opacity-60',
              )}
            >
              {uploading ? (
                <>
                  <Loader2 className="text-brand-600 size-6 animate-spin" aria-hidden />
                  <span className="text-xs font-medium">Uploading… {uploadPercent}%</span>
                </>
              ) : (
                <>
                  <ImagePlus className="size-6" aria-hidden />
                  <span className="text-sm font-semibold">Click to upload</span>
                  <span className="text-xs">JPG, PNG or WebP · max 5 MB</span>
                </>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="sr-only"
                onChange={(event) => void onPickImage(event.target.files?.[0])}
              />
            </label>
          )}
        </div>

        <Input
          {...register('name')}
          label="Dish name"
          placeholder="Paneer Butter Masala"
          error={errors.name?.message}
          required
        />

        <Textarea
          {...register('description')}
          label="Description"
          rows={3}
          placeholder="Rich tomato and cashew gravy with fresh cream…"
          error={errors.description?.message}
          required
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            {...register('price')}
            label="Price"
            inputMode="decimal"
            placeholder="249"
            leadingIcon={<span className="text-sm font-bold">₹</span>}
            error={errors.price?.message}
            hint="In rupees"
            required
          />
          <Input
            {...register('category')}
            label="Category"
            placeholder="Main course"
            error={errors.category?.message}
            required
          />
          <Input
            {...register('sortOrder', { valueAsNumber: true })}
            label="Sort order"
            type="number"
            min={0}
            max={999}
            error={errors.sortOrder?.message}
            hint="Lower shows first"
          />
        </div>

        <div className="flex flex-wrap gap-5">
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={isVeg}
              onChange={(event) => setValue('isVeg', event.target.checked)}
              className="accent-brand-600 size-4.5 rounded"
            />
            <span className="text-ink-700 text-sm">Vegetarian</span>
          </label>

          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={isAvailable}
              onChange={(event) => setValue('isAvailable', event.target.checked)}
              className="accent-brand-600 size-4.5 rounded"
            />
            <span className="text-ink-700 text-sm">Available to order</span>
          </label>
        </div>
      </form>
    </Modal>
  );
}
