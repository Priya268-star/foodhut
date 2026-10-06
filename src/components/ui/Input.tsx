import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';

import { cn } from '@/lib/cn';

interface FieldShellProps {
  id: string;
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

/** Shared label/hint/error chrome so every field is announced identically. */
function FieldShell({ id, label, hint, error, required, children, className }: FieldShellProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-ink-800 block text-sm font-medium">
          {label}
          {required && (
            <span className="text-brand-600 ml-0.5" aria-hidden>
              *
            </span>
          )}
        </label>
      )}

      {children}

      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-ink-500 text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const CONTROL = cn(
  'w-full rounded-xl border bg-white px-3.5 text-sm text-ink-900 shadow-xs',
  'placeholder:text-ink-400',
  'transition-colors duration-150',
  'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none',
  'disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-400',
);

function controlClasses(hasError: boolean, extra?: string) {
  return cn(
    CONTROL,
    hasError ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : 'border-ink-300',
    extra,
  );
}

/* --------------------------------- Input ---------------------------------- */

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  hint?: string;
  error?: string;
  leadingIcon?: ReactNode;
  trailingSlot?: ReactNode;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hint,
    error,
    leadingIcon,
    trailingSlot,
    className,
    wrapperClassName,
    id,
    required,
    ...rest
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <FieldShell
      id={inputId}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={wrapperClassName}
    >
      <div className="relative">
        {leadingIcon && (
          <span className="text-ink-400 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
            {leadingIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={controlClasses(
            Boolean(error),
            cn('h-11', leadingIcon && 'pl-10', trailingSlot && 'pr-11', className),
          )}
          {...rest}
        />
        {trailingSlot && (
          <span className="absolute top-1/2 right-2 -translate-y-1/2">{trailingSlot}</span>
        )}
      </div>
    </FieldShell>
  );
});

/* ------------------------------- Textarea --------------------------------- */

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, wrapperClassName, id, required, rows = 4, ...rest },
  ref,
) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <FieldShell
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={wrapperClassName}
    >
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={controlClasses(Boolean(error), cn('resize-y py-2.5 leading-relaxed', className))}
        {...rest}
      />
    </FieldShell>
  );
});

/* --------------------------------- Checkbox ------------------------------- */

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, className, id, ...rest },
  ref,
) {
  const generatedId = useId();
  const boxId = id ?? generatedId;

  return (
    <div className="flex items-center gap-2.5">
      <input
        ref={ref}
        id={boxId}
        type="checkbox"
        className={cn(
          'border-ink-300 text-brand-600 size-4.5 shrink-0 cursor-pointer rounded',
          'focus:ring-brand-500/30 focus:ring-2 focus:ring-offset-0',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...rest}
      />
      <label htmlFor={boxId} className="text-ink-700 cursor-pointer text-sm select-none">
        {label}
      </label>
    </div>
  );
});
