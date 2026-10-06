import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { toUserMessage } from '@/lib/firebase/errors';
import {
  addressSchema,
  profileSchema,
  type AddressValues,
  type ProfileValues,
} from '@/lib/validation/schemas';
import { useAuth } from '@/context/AuthContext';
import { useAddresses } from '@/hooks/useAddresses';
import { deleteAddress, saveAddress, updateUserProfile } from '@/services/auth';
import { Button } from '@/components/ui/Button';
import { Checkbox, Input } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Alert, Avatar, Card, Spinner } from '@/components/ui/Primitives';
import type { Address } from '@/types/models';

export function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const { addresses } = useAddresses();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [notice, setNotice] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Address | null>(null);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  // Owner? Send them to the dashboard — the whole point of that role.
  useEffect(() => {
    if (params.get('tab') === 'dashboard' && profile?.role === 'owner') {
      navigate('/admin', { replace: true });
    }
  }, [params, profile?.role, navigate]);

  const profileForm = useForm<ProfileValues>({
    // Reuse the shared schema so profile and auth rules stay in sync.
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName: profile?.displayName ?? '', phone: profile?.phone ?? '' },
  });

  // Keep the form in sync once the profile resolves.
  useEffect(() => {
    if (profile) {
      profileForm.reset({
        displayName: profile.displayName,
        phone: profile.phone ?? '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const saveProfile = profileForm.handleSubmit(async (values) => {
    if (!user) return;
    setSavingProfile(true);
    setProfileError(null);
    try {
      await updateUserProfile(user.uid, {
        displayName: values.displayName,
        phone: values.phone || null,
      });
      await refreshProfile();
      setNotice('Profile updated.');
    } catch (error) {
      setProfileError(toUserMessage(error, 'Could not update your profile.'));
    } finally {
      setSavingProfile(false);
    }
  });

  if (!user || !profile) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="size-6" label="Loading your profile" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-ink-900 mb-6 text-xl font-bold tracking-tight sm:text-2xl">My profile</h1>

      {notice && (
        <Alert tone="success" className="mb-5" title={notice}>
          <button type="button" onClick={() => setNotice(null)} className="text-xs underline">
            Dismiss
          </button>
        </Alert>
      )}

      <Card className="mb-6 p-5">
        <div className="flex items-center gap-4">
          <Avatar name={profile.displayName} src={profile.photoURL} className="size-14 text-lg" />
          <div className="min-w-0">
            <p className="text-ink-900 truncate text-lg font-bold">{profile.displayName}</p>
            <p className="text-ink-500 truncate text-sm">{profile.email}</p>
            {profile.role !== 'customer' && (
              <span className="bg-brand-100 text-brand-700 mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-bold capitalize">
                {profile.role}
              </span>
            )}
          </div>
        </div>

        <form onSubmit={saveProfile} noValidate className="mt-6 space-y-4">
          {profileError && <Alert tone="danger">{profileError}</Alert>}

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              {...profileForm.register('displayName')}
              label="Full name"
              error={profileForm.formState.errors.displayName?.message}
              required
            />
            <Input
              {...profileForm.register('phone')}
              label="Phone"
              type="tel"
              placeholder="98765 43210"
              error={profileForm.formState.errors.phone?.message}
            />
          </div>

          <Button type="submit" loading={savingProfile} size="sm">
            Save changes
          </Button>
        </form>
      </Card>

      <AddressesCard
        addresses={addresses}
        editing={editingAddress}
        onEdit={setEditingAddress}
        onDelete={setDeleteTarget}
        onSaved={setNotice}
        userId={user.uid}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this address?"
        message={`"${deleteTarget?.label ?? ''}" will be removed from your saved addresses.`}
        confirmLabel="Delete address"
        destructive
        onConfirm={() => {
          if (deleteTarget) {
            void deleteAddress(user.uid, deleteTarget.id)
              .then(() => setNotice('Address deleted.'))
              .catch((error: unknown) => console.error(toUserMessage(error)))
              .finally(() => setDeleteTarget(null));
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

/* ------------------------------- addresses -------------------------------- */

function AddressesCard({
  addresses,
  editing,
  onEdit,
  onDelete,
  onSaved,
  userId,
}: {
  addresses: Address[];
  /** `null` = closed. A blank `id` means "new address, not yet persisted". */
  editing: Address | null;
  onEdit: (address: Address | null) => void;
  onDelete: (address: Address) => void;
  onSaved: (message: string) => void;
  userId: string;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /*
   * The id is minted when the form opens rather than on submit, so the value
   * is stable across re-renders and the render stays pure.
   */
  const [draftId, setDraftId] = useState('');

  const form = useForm<AddressValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: { label: 'Home', isDefault: true },
  });

  useEffect(() => {
    if (editing) {
      // Existing address: keep its id.
      setDraftId(editing.id);
      form.reset({
        label: editing.label,
        line1: editing.line1,
        line2: editing.line2 ?? '',
        city: editing.city,
        postalCode: editing.postalCode,
        phone: editing.phone,
        isDefault: editing.isDefault,
      });
    } else {
      // New address: mint an id now, once.
      setDraftId(crypto.randomUUID());
      form.reset({
        label: 'Home',
        line1: '',
        line2: '',
        city: '',
        postalCode: '',
        phone: '',
        isDefault: addresses.length === 0,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const submit = form.handleSubmit(async (values) => {
    setSaving(true);
    setError(null);
    try {
      await saveAddress(userId, {
        id: draftId,
        label: values.label,
        line1: values.line1,
        line2: values.line2 || undefined,
        city: values.city,
        postalCode: values.postalCode,
        phone: values.phone,
        isDefault: values.isDefault,
      });
      onSaved(editing?.id ? 'Address updated.' : 'Address saved.');
    } catch (err) {
      setError(toUserMessage(err, 'Could not save this address.'));
    } finally {
      setSaving(false);
    }
  });

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-ink-900 text-base font-bold">Saved addresses</h2>
        {!editing && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onEdit({
                id: '',
                label: '',
                line1: '',
                city: '',
                postalCode: '',
                phone: '',
                isDefault: false,
              } as Address)
            }
          >
            Add address
          </Button>
        )}
      </div>

      {addresses.length === 0 && !editing && (
        <p className="text-ink-500 mt-3 text-sm">
          No saved addresses yet. Add one to check out faster.
        </p>
      )}

      {addresses.length > 0 && (
        <ul className="mt-4 space-y-2.5">
          {addresses.map((address) => (
            <li
              key={address.id}
              className="border-ink-200 flex flex-wrap items-start justify-between gap-3 rounded-xl border p-3.5"
            >
              <div className="min-w-0">
                <p className="text-ink-900 flex items-center gap-2 text-sm font-semibold">
                  {address.label}
                  {address.isDefault && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[0.65rem] font-bold text-emerald-700">
                      Default
                    </span>
                  )}
                </p>
                <p className="text-ink-600 mt-0.5 text-sm">
                  {address.line1}
                  {address.line2 ? `, ${address.line2}` : ''}
                </p>
                <p className="text-ink-600 text-sm">
                  {address.city} {address.postalCode} · {address.phone}
                </p>
              </div>

              <div className="flex gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => onEdit(address)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => onDelete(address)}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <form onSubmit={submit} noValidate className="border-ink-100 mt-5 space-y-4 border-t pt-5">
          <h3 className="text-ink-900 text-sm font-bold">
            {editing.id ? 'Edit address' : 'New address'}
          </h3>

          {error && <Alert tone="danger">{error}</Alert>}

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              {...form.register('label')}
              label="Label"
              error={form.formState.errors.label?.message}
              required
            />
            <Input
              {...form.register('phone')}
              label="Phone"
              type="tel"
              error={form.formState.errors.phone?.message}
              required
            />
            <Input
              {...form.register('line1')}
              label="Flat, house no., building"
              error={form.formState.errors.line1?.message}
              required
              wrapperClassName="sm:col-span-2"
            />
            <Input
              {...form.register('line2')}
              label="Area, street (optional)"
              wrapperClassName="sm:col-span-2"
            />
            <Input
              {...form.register('city')}
              label="City"
              error={form.formState.errors.city?.message}
              required
            />
            <Input
              {...form.register('postalCode')}
              label="PIN code"
              inputMode="numeric"
              error={form.formState.errors.postalCode?.message}
              required
            />
          </div>

          <Checkbox {...form.register('isDefault')} label="Use as my default address" />

          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={saving}>
              {editing.id ? 'Update address' : 'Save address'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => onEdit(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
