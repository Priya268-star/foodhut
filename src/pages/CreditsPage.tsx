import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';

import { Alert, Card, Spinner } from '@/components/ui/Primitives';

interface Credit {
  slug: string;
  title?: string;
  licence?: string;
  author?: string;
  page?: string;
  placeholder?: boolean;
  label?: string;
}

/**
 * Photo credits page.
 *
 * Roughly half the seeded photos are CC BY / CC BY-SA. Those licences require
 * attribution to be *provided to the user*, which a file in the repository
 * does not do — so the credits are rendered in the app itself, reachable from
 * the footer. Regenerate the underlying data with `npm run images`.
 */
export function CreditsPage() {
  const [credits, setCredits] = useState<Credit[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Written into the bundle at build time, so this works offline and on any host.
    import('@/data/credits.json')
      .then((module) => {
        const data = (module.default ?? module) as {
          photos: Credit[];
          placeholders: Credit[];
        };
        setCredits([...data.photos, ...data.placeholders]);
      })
      .catch(() => setError('Could not load the photo credits.'));
  }, []);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Alert tone="danger">{error}</Alert>
      </div>
    );
  }

  if (!credits) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="size-6" label="Loading credits" />
      </div>
    );
  }

  const photos = credits.filter((c) => !c.placeholder);
  const placeholders = credits.filter((c) => c.placeholder);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-600 transition-colors hover:text-brand-600"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back
      </Link>

      <h1 className="mt-4 text-2xl font-black tracking-tight text-ink-900">Photo credits</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-600">
        Dish and restaurant photos come from Wikimedia Commons and are used under the licence listed
        against each one. Anything without a licence we could verify is free was replaced with a
        generated card rather than shipped with an unclear licence.
      </p>

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-ink-100 bg-ink-50 px-4 py-3">
          <h2 className="text-sm font-bold text-ink-900">
            Photographs ({photos.length})
          </h2>
        </div>
        <ul className="divide-y divide-ink-100">
          {photos.map((credit) => (
            <li key={credit.slug} className="flex items-center gap-3 px-4 py-2.5">
              <img
                src={`/dishes/${credit.slug}.jpg`}
                alt=""
                loading="lazy"
                className="size-10 shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-800">
                  {(credit.title ?? credit.slug).replace(/^File:/, '')}
                </p>
                <p className="text-xs text-ink-500">
                  {credit.author ?? 'Unknown'} ·{' '}
                  <span className="font-medium text-ink-600">{credit.licence}</span>
                </p>
              </div>
              {credit.page && (
                <a
                  href={credit.page}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="shrink-0 text-ink-400 transition-colors hover:text-brand-600"
                  aria-label={`View source of ${credit.slug} on Wikimedia Commons`}
                >
                  <ExternalLink className="size-4" aria-hidden />
                </a>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {placeholders.length > 0 && (
        <Card className="mt-5 overflow-hidden">
          <div className="border-b border-ink-100 bg-ink-50 px-4 py-3">
            <h2 className="text-sm font-bold text-ink-900">
              Generated cards ({placeholders.length})
            </h2>
          </div>
          <p className="px-4 py-3 text-sm text-ink-600">
            No photo with a clearly free licence could be matched for these, so a generated card is
            used instead — a confidently wrong photo is worse than an honest placeholder. An owner
            can upload a real photo from the dashboard.
          </p>
          <ul className="flex flex-wrap gap-2 px-4 pb-4">
            {placeholders.map((credit) => (
              <li
                key={credit.slug}
                className="rounded-full bg-ink-100 px-2.5 py-1 text-xs font-medium text-ink-600"
              >
                {credit.label ?? credit.slug}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="mt-6 text-xs text-ink-400">
        Full details, including the licence text for each file, are in{' '}
        <code className="rounded bg-ink-100 px-1 py-0.5">ATTRIBUTIONS.md</code> in the repository.
      </p>
    </div>
  );
}