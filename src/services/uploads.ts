/**
 * Firebase Storage uploads.
 *
 * Images are stored under predictable, user-scoped paths and served via
 * long-lived download URLs. Rules (see `storage.rules`) restrict each path to
 * the uploader, and cap both file size and content type.
 */
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
  uploadBytesResumable,
  type UploadTask,
} from 'firebase/storage';

import { firebaseStorage } from '@/config/firebase';
import { toUserMessage } from '@/lib/firebase/errors';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export interface UploadTarget {
  /** Ownership segment: the uid allowed to write this prefix. */
  ownerId: string;
  scope: 'restaurants' | 'menu' | 'reviews';
  entityId: string;
  fileName: string;
}

export interface ImageValidationResult {
  ok: boolean;
  error?: string;
}

/** Client-side guard so users get instant feedback instead of a failed upload. */
export function validateImageFile(file: File): ImageValidationResult {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: 'Only JPG, PNG, WebP or AVIF images are allowed.' };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: 'Image must be smaller than 5 MB.' };
  }
  return { ok: true };
}

/** Strips the extension, keeps it safe for a storage path. */
function sanitiseName(name: string): string {
  const base = name
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  const safe = base.replace(/^-+|-+$/g, '').slice(0, 40) || 'image';
  return `${Date.now()}-${safe}`;
}

function buildPath(target: UploadTarget): string {
  const extension = target.fileName.split('.').pop()?.toLowerCase() ?? 'jpg';
  return `${target.scope}/${target.ownerId}/${target.entityId}/${sanitiseName(target.fileName)}.${extension}`;
}

/**
 * Uploads a file and returns its download URL.
 * `onProgress` receives 0–100 so the UI can show a real progress bar.
 */
export function uploadImage(
  file: File,
  target: UploadTarget,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const validation = validateImageFile(file);
  if (!validation.ok) {
    return Promise.reject(new Error(validation.error ?? 'Invalid image.'));
  }

  const ref = storageRef(firebaseStorage(), buildPath(target));
  const task: UploadTask = uploadBytesResumable(ref, file, {
    contentType: file.type,
    // Long cache: filenames are unique, so the bytes never change.
    cacheControl: 'public,max-age=31536000,immutable',
  });

  return new Promise<string>((resolve, reject) => {
    task.on(
      'state_changed',
      (snapshot) => {
        const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        onProgress?.(percent);
      },
      (error) => reject(new Error(toUserMessage(error, 'Image upload failed.'))),
      async () => {
        try {
          resolve(await getDownloadURL(task.snapshot.ref));
        } catch (error) {
          reject(new Error(toUserMessage(error, 'Could not read the uploaded image.')));
        }
      },
    );
  });
}

/** One-shot upload for small images where progress is not worth the ceremony. */
export async function uploadImageSimple(file: File, target: UploadTarget): Promise<string> {
  const validation = validateImageFile(file);
  if (!validation.ok) {
    throw new Error(validation.error ?? 'Invalid image.');
  }

  const ref = storageRef(firebaseStorage(), buildPath(target));
  await uploadBytes(ref, file, {
    contentType: file.type,
    cacheControl: 'public,max-age=31536000,immutable',
  });
  return getDownloadURL(ref);
}
