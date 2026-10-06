import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, User as UserIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { toUserMessage } from '@/lib/firebase/errors';
import {
  loginSchema,
  signupSchema,
  type LoginValues,
  type SignupValues,
} from '@/lib/validation/schemas';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert, Spinner } from '@/components/ui/Primitives';
import { GoogleButton } from '@/components/GoogleButton';

interface AuthPageProps {
  mode: 'login' | 'signup';
}

export function AuthPage({ mode }: AuthPageProps) {
  const isLogin = mode === 'login';
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);

  // Where to go after a successful sign-in. `ProtectedRoute` put it in state.
  const redirectTo = (location.state as { from?: string } | null)?.from ?? (isLogin ? '/' : '/');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues & Partial<SignupValues>>({
    resolver: zodResolver(isLogin ? loginSchema : signupSchema),
    mode: 'onBlur',
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (isLogin) {
        const { email, password } = values as LoginValues;
        await signIn(email, password);
      } else {
        const { name, email, password } = values as SignupValues;
        await signUp(name, email, password);
      }
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setFormError(toUserMessage(error));
    }
  });

  const onGoogle = async () => {
    setGoogleBusy(true);
    setFormError(null);
    try {
      await signInWithGoogle();
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setFormError(toUserMessage(error));
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-md flex-col justify-center px-4 py-12">
      <div className="text-center">
        <Link to="/" className="inline-flex items-center gap-1.5" aria-label="Foodhut home">
          <span className="bg-brand-600 flex size-11 items-center justify-center rounded-2xl text-xl font-black text-white">
            F
          </span>
        </Link>
        <h1 className="text-ink-900 mt-4 text-2xl font-black tracking-tight">
          {isLogin ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="text-ink-500 mt-1.5 text-sm">
          {isLogin
            ? 'Log in to order food and track your deliveries.'
            : 'Sign up to start ordering from the best restaurants near you.'}
        </p>
      </div>

      <div className="mt-8">
        <GoogleButton onClick={onGoogle} loading={googleBusy} label="Continue with Google" />
      </div>

      <div className="my-6 flex items-center gap-3">
        <span className="bg-ink-200 h-px flex-1" />
        <span className="text-ink-400 text-xs font-medium uppercase">or continue with email</span>
        <span className="bg-ink-200 h-px flex-1" />
      </div>

      {formError && (
        <Alert tone="danger" className="mb-4">
          {formError}
        </Alert>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {!isLogin && (
          <Input
            {...register('name')}
            label="Full name"
            autoComplete="name"
            placeholder="Aarav Sharma"
            leadingIcon={<UserIcon className="size-4" />}
            error={errors.name?.message}
            required
          />
        )}

        <Input
          {...register('email')}
          type="email"
          label="Email address"
          autoComplete="email"
          placeholder="you@example.com"
          leadingIcon={<Mail className="size-4" />}
          error={errors.email?.message}
          required
        />

        <Input
          {...register('password')}
          type={showPassword ? 'text' : 'password'}
          label="Password"
          autoComplete={isLogin ? 'current-password' : 'new-password'}
          placeholder={isLogin ? 'Your password' : 'At least 8 characters'}
          leadingIcon={<span className="text-xs font-bold">🔒</span>}
          error={errors.password?.message}
          required
          hint={!isLogin ? 'Must include upper case, lower case and a number.' : undefined}
          trailingSlot={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="text-ink-400 hover:bg-ink-100 hover:text-ink-700 rounded p-1.5 transition-colors"
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden />
              ) : (
                <Eye className="size-4" aria-hidden />
              )}
            </button>
          }
        />

        {!isLogin && (
          <Input
            {...register('confirmPassword')}
            type={showPassword ? 'text' : 'password'}
            label="Confirm password"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            error={errors.confirmPassword?.message}
            required
          />
        )}

        <Button type="submit" size="lg" fullWidth loading={isSubmitting && !formError}>
          {isLogin ? 'Log in' : 'Create account'}
        </Button>
      </form>

      <p className="text-ink-500 mt-6 text-center text-sm">
        {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
        <Link
          to={isLogin ? '/signup' : '/login'}
          state={location.state}
          className="text-brand-600 hover:text-brand-700 font-semibold"
        >
          {isLogin ? 'Sign up' : 'Log in'}
        </Link>
      </p>

      <p className="text-ink-400 mt-4 text-center text-xs">
        By continuing you agree to Foodhut's Terms and Privacy Policy.
      </p>

      {isSubmitting && (
        <p className="text-ink-500 mt-4 flex items-center justify-center gap-2 text-xs">
          <Spinner className="size-3.5" />
          Please wait…
        </p>
      )}
    </div>
  );
}
