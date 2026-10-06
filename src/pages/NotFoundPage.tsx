import { Link } from 'react-router-dom';
import { Compass, Home, Search } from 'lucide-react';

import { Button } from '@/components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="bg-brand-100 text-brand-600 mx-auto flex size-16 items-center justify-center rounded-2xl">
          <Compass className="size-8" aria-hidden />
        </div>

        <p className="text-ink-900 mt-6 text-5xl font-black tracking-tight">404</p>
        <h1 className="text-ink-900 mt-2 text-xl font-bold">We couldn't find that page</h1>
        <p className="text-ink-500 mt-2 text-sm">
          The link may be broken, or the page may have been moved.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <Link to="/">
            <Button leadingIcon={<Home className="size-4" />}>Back to home</Button>
          </Link>
          <Link to="/">
            <Button variant="outline" leadingIcon={<Search className="size-4" />}>
              Browse restaurants
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
