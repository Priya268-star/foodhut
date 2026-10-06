/**
 * Zod schemas — the single source of truth for form validation.
 *
 * Keeping these next to each other (rather than inside components) means the
 * same rules can be reused in tests or by a Cloud Function later.
 */
import { z } from 'zod';

import { parseRupeesToPaise } from '@/lib/format';

const requiredText = (label: string, max = 120) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be under ${max} characters`);

/* ---------------------------------- auth ---------------------------------- */

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .email('Enter a valid email address')
  .max(254, 'That email address is too long');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be under 72 characters')
  .regex(/[a-z]/, 'Include at least one lowercase letter')
  .regex(/[A-Z]/, 'Include at least one uppercase letter')
  .regex(/\d/, 'Include at least one number');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export type LoginValues = z.infer<typeof loginSchema>;

export const signupSchema = z
  .object({
    name: requiredText('Name', 60),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export type SignupValues = z.infer<typeof signupSchema>;

/* -------------------------------- checkout -------------------------------- */

export const addressSchema = z.object({
  label: requiredText('Address label', 30),
  line1: requiredText('Flat, house no. and building', 160),
  line2: z.string().trim().max(160, 'That is too long').optional().or(z.literal('')),
  city: requiredText('City', 60),
  postalCode: z
    .string()
    .trim()
    .min(1, 'PIN code is required')
    .regex(/^\d{4,10}$/, 'Enter a valid PIN code'),
  phone: z
    .string()
    .trim()
    .min(1, 'Phone number is required')
    .regex(/^[+]?[\d\s-]{7,15}$/, 'Enter a valid phone number'),
  isDefault: z.boolean(),
});

export type AddressValues = z.infer<typeof addressSchema>;

export const checkoutSchema = z.object({
  address: addressSchema,
  paymentMethod: z.enum(['cod', 'card_simulated']),
  saveAddress: z.boolean(),
});

export type CheckoutValues = z.infer<typeof checkoutSchema>;

/* ------------------------------ menu (owner) ------------------------------ */

const priceSchema = z
  .string()
  .trim()
  .min(1, 'Price is required')
  .refine(
    (value) => Number.parseFloat(value.replace(/[^\d.]/g, '')) > 0,
    'Enter a price above zero',
  );

export const menuItemSchema = z.object({
  name: requiredText('Dish name', 80),
  description: requiredText('Description', 240),
  price: priceSchema,
  category: requiredText('Category', 40),
  imageUrl: z.string().url('Upload an image or paste a valid URL').or(z.literal('')),
  isVeg: z.boolean(),
  isAvailable: z.boolean(),
  // `z.coerce` makes the *input* `unknown`, which fights react-hook-form's
  // generics. Parse the string in the form layer and keep this a plain number.
  sortOrder: z.number().int('Whole numbers only').min(0, 'Cannot be negative').max(999, 'Max 999'),
});

export type MenuItemValues = z.infer<typeof menuItemSchema>;

/** The form stores rupees as a string; Firestore stores paise as a number. */
export function menuItemValuesToPaise(values: MenuItemValues) {
  return parseRupeesToPaise(values.price);
}

/* ------------------------------- review form ------------------------------ */

export const reviewSchema = z.object({
  rating: z.number({ message: 'Tap a star to rate' }).int().min(1, 'Tap a star to rate').max(5),
  comment: z
    .string()
    .trim()
    .min(10, 'Tell us a little more — at least 10 characters')
    .max(1000, 'Reviews are limited to 1000 characters'),
});

export type ReviewValues = z.infer<typeof reviewSchema>;

/* ----------------------------- profile update ----------------------------- */

export const profileSchema = z.object({
  displayName: requiredText('Name', 60),
  phone: z
    .string()
    .trim()
    .regex(/^$|^[+]?[\d\s-]{7,15}$/, 'Enter a valid phone number'),
});

export type ProfileValues = z.infer<typeof profileSchema>;
