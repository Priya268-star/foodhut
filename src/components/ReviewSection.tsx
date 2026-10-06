import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquareOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { toUserMessage } from '@/lib/firebase/errors';
import { reviewSchema, type ReviewValues } from '@/lib/validation/schemas';
import { useAuth } from '@/context/AuthContext';
import { useReviews } from '@/hooks/useFirestoreData';
import { deleteReview, submitReview } from '@/services/reviews';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { StarInput, StarRating } from '@/components/ui/StarRating';
import { Alert, Avatar, EmptyState, Spinner } from '@/components/ui/Primitives';
import type { Restaurant } from '@/types/models';

/**
 * Reviews for a restaurant: summary row, list, and an inline submit form.
 * The form validates with Zod via react-hook-form so error handling matches
 * the rest of the app.
 */
export function ReviewSection({ restaurant }: { restaurant: Restaurant }) {
  const { data: reviews, loading, error } = useReviews(restaurant.id);
  const { user, profile, isSignedIn } = useAuth();

  const average =
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : restaurant.rating;

  return (
    <section aria-labelledby="reviews-heading" className="mt-12">
      <h2 id="reviews-heading" className="text-ink-900 text-lg font-bold tracking-tight">
        Ratings & reviews
      </h2>

      <div className="mt-4 grid gap-6 md:grid-cols-[auto_1fr]">
        {/* Summary */}
        <div className="rounded-card border-ink-200/80 shadow-card flex flex-row items-center gap-4 border bg-white p-5 md:flex-col md:items-start">
          <div className="text-center">
            <p className="text-ink-900 text-4xl font-black">{average.toFixed(1)}</p>
            <div className="mt-1.5 flex justify-center">
              <StarRating value={average} size={16} />
            </div>
            <p className="text-ink-500 mt-1 text-xs">
              {reviews.length} review{reviews.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {isSignedIn && user ? (
            <ReviewForm
              restaurantId={restaurant.id}
              userId={user.uid}
              userName={profile?.displayName ?? user.displayName ?? 'Foodhut user'}
              userPhotoURL={profile?.photoURL ?? user.photoURL}
              existingReview={reviews.find((review) => review.userId === user.uid) ?? null}
            />
          ) : (
            <Alert tone="info" title="Sign in to leave a review">
              <Link to="/login" className="text-brand-700 font-semibold">
                Log in
              </Link>{' '}
              or{' '}
              <Link to="/signup" className="text-brand-700 font-semibold">
                create an account
              </Link>{' '}
              to share your experience.
            </Alert>
          )}

          {error && <Alert tone="danger">{error}</Alert>}

          {loading ? (
            <div className="flex justify-center py-6">
              <Spinner className="size-6" />
            </div>
          ) : reviews.length === 0 ? (
            <EmptyState
              icon={<MessageSquareOff className="size-6" />}
              title="No reviews yet"
              description="Be the first to review this restaurant."
              className="py-10"
            />
          ) : (
            <ul className="space-y-3">
              {reviews.map((review) => (
                <li
                  key={review.id}
                  className="rounded-card border-ink-200/80 shadow-card border bg-white p-4"
                >
                  <div className="flex items-start gap-3">
                    <Avatar
                      name={review.userName}
                      src={review.userPhotoURL}
                      className="size-9 shrink-0 text-xs"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-ink-900 text-sm font-semibold">{review.userName}</p>
                          <p className="text-ink-400 text-xs">
                            {review.createdAt.toDate().toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StarRating value={review.rating} size={12} />
                          {review.userId === user?.uid && (
                            <button
                              type="button"
                              onClick={() => {
                                void deleteReview(restaurant.id, review.id).catch((err: unknown) =>
                                  console.error('[reviews] delete failed', toUserMessage(err)),
                                );
                              }}
                              className="text-ink-400 text-xs font-medium transition-colors hover:text-red-600"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                      {review.comment && (
                        <p className="text-ink-600 mt-2 text-sm leading-relaxed">
                          {review.comment}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------- form ----------------------------------- */

function ReviewForm({
  restaurantId,
  userId,
  userName,
  userPhotoURL,
  existingReview,
}: {
  restaurantId: string;
  userId: string;
  userName: string;
  userPhotoURL: string | null;
  existingReview: { id: string; rating: number; comment: string } | null;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ReviewValues>({
    resolver: zodResolver(reviewSchema),
    mode: 'onBlur',
    defaultValues: {
      rating: existingReview?.rating ?? 0,
      comment: existingReview?.comment ?? '',
    },
  });

  const rating = watch('rating');

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    setFormError(null);

    try {
      await submitReview({
        userId,
        userName,
        userPhotoURL,
        restaurantId,
        menuItemId: null,
        rating: values.rating,
        comment: values.comment,
      });
      setSubmitted(true);
      reset({ rating: values.rating, comment: '' });
      window.setTimeout(() => setSubmitted(false), 4000);
    } catch (error) {
      setFormError(toUserMessage(error, 'Could not submit your review.'));
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="rounded-card border-ink-200/80 shadow-card border bg-white p-5"
    >
      <h3 className="text-ink-900 text-sm font-bold">
        {existingReview ? 'Update your review' : 'Write a review'}
      </h3>

      {formError && (
        <Alert tone="danger" className="mt-3">
          {formError}
        </Alert>
      )}
      {submitted && (
        <Alert tone="success" className="mt-3">
          Thanks for your review!
        </Alert>
      )}

      <div className="mt-4 space-y-4">
        <div>
          <span className="text-ink-800 mb-1.5 block text-sm font-medium">Your rating</span>
          <StarInput
            value={rating}
            onChange={(value) =>
              setValue('rating', value, { shouldValidate: true, shouldDirty: true })
            }
          />
          {errors.rating && (
            <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">
              {errors.rating.message}
            </p>
          )}
        </div>

        <Textarea
          {...register('comment')}
          label="Your experience"
          placeholder="What did you order? How was the taste, portion and delivery?"
          error={errors.comment?.message}
          maxLength={1000}
          rows={3}
        />

        <Button type="submit" loading={submitting} size="sm">
          {existingReview ? 'Update review' : 'Post review'}
        </Button>
      </div>
    </form>
  );
}
