import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/Button';

interface ErrorBoundaryProps {
  children?: ReactNode;
  /** Custom fallback; receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render-time errors so one broken page cannot blank the whole app.
 *
 * Must be a class: React has no hook equivalent for error boundaries.
 * Also wired to React Router's `errorElement` for loader/render failures.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Replace with your error reporter (Sentry, etc.) in production.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (!error) return children;
    if (fallback) return fallback(error, this.reset);

    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertTriangle className="size-7" aria-hidden />
          </div>

          <h1 className="text-ink-900 mt-5 text-xl font-bold">Something went wrong</h1>
          <p className="text-ink-500 mt-2 text-sm">
            An unexpected error occurred on this page. Try again — if it keeps happening, please
            check the browser console for details.
          </p>

          {import.meta.env.DEV && (
            <pre className="bg-ink-900 text-ink-100 mt-4 max-h-40 overflow-auto rounded-xl p-3 text-left text-xs">
              {error.message}
            </pre>
          )}

          <div className="mt-6 flex justify-center gap-2">
            <Button onClick={this.reset} leadingIcon={<RefreshCw className="size-4" />}>
              Try again
            </Button>
            <Button variant="outline" onClick={() => window.location.assign('/')}>
              Go to home
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
