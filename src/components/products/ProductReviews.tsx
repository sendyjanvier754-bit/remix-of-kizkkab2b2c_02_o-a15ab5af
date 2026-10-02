import { useState } from "react";
import { useProductReviews, useReviewStats, useAddReview, useDeleteReview, ProductReview } from "@/hooks/useProductReviews";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Star, ThumbsUp, Trash2, User, MessageSquare, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useTranslation } from "react-i18next";

interface ProductReviewsProps {
  productId: string;
  productName?: string;
}

// Función para ofuscar email: j***o@email.com
const obfuscateEmail = (email: string): string => {
  if (!email) return "";
  const [localPart, domain] = email.split("@");
  if (localPart.length <= 1) return email;
  const firstChar = localPart[0];
  const lastChar = localPart[localPart.length - 1];
  const asterisks = "*".repeat(Math.max(1, localPart.length - 2));
  return `${firstChar}${asterisks}${lastChar}@${domain}`;
};

const StarRating = ({
  rating,
  size = "sm",
  interactive = false,
  onRatingChange,
}: {
  rating: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
}) => {
  const [hoverRating, setHoverRating] = useState(0);
  const sizeClass = size === "sm" ? "h-3 w-3" : size === "md" ? "h-4 w-4" : "h-5 w-5";

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => interactive && onRatingChange?.(star)}
          onMouseEnter={() => interactive && setHoverRating(star)}
          onMouseLeave={() => interactive && setHoverRating(0)}
          className={cn(
            "transition-colors",
            interactive && "cursor-pointer hover:scale-110"
          )}
        >
          <Star
            className={cn(
              sizeClass,
              (hoverRating || rating) >= star
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300"
            )}
          />
        </button>
      ))}
    </div>
  );
};

const ReviewCard = ({
  review,
  currentUserId,
  onDelete,
  onReply,
}: {
  review: ProductReview;
  currentUserId?: string;
  onDelete: (reviewId: string) => void;
  onReply: (reviewId: string, authorName: string) => void;
}) => {
  const isOwner = currentUserId === review.user_id;
  const displayName = review.user_email ? obfuscateEmail(review.user_email) : review.user_name;

  return (
    <div className="border-b pb-4 last:border-b-0">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="font-medium text-sm text-foreground">
              {displayName}
            </p>
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {format(new Date(review.created_at), "MMM d, yyyy", { locale: es })}
            </span>
          </div>
          
          <div className="flex items-center gap-2 mb-2">
            <StarRating rating={review.rating} size="sm" />
          </div>

          {review.title && (
            <p className="text-sm text-gray-600 mb-1">{review.title}</p>
          )}

          {review.comment && (
            <p className="text-sm text-gray-700 mb-2 line-clamp-3">
              {review.comment}
            </p>
          )}

          <div className="flex items-center gap-3 mt-2">
            <button className="flex items-center gap-1 text-xs text-gray-600 hover:text-foreground transition-colors">
              <ThumbsUp className="h-4 w-4" />
              <span>Útil ({review.helpful_count})</span>
            </button>
            <button 
              onClick={() => onReply(review.id, displayName)}
              className="flex items-center gap-1 text-xs text-gray-600 hover:text-foreground transition-colors"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Responder</span>
            </button>
            <button className="text-gray-600 hover:text-foreground">
              <span className="text-xl">⋯</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ProductReviews = ({ productId, productName }: ProductReviewsProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: reviews, isLoading } = useProductReviews(productId);
  const stats = useReviewStats(productId);
  const addReview = useAddReview();
  const deleteReview = useDeleteReview();

  const [showForm, setShowForm] = useState(false);
  const [newRating, setNewRating] = useState(0);
  const [newTitle, setNewTitle] = useState("");
  const [newComment, setNewComment] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyingToName, setReplyingToName] = useState("");
  const [isReply, setIsReply] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isReply) {
      // Handle reply submission
      if (!newComment.trim()) return;
      
      await addReview.mutateAsync({
        product_id: productId,
        rating: 0, // Replies don't have ratings
        title: undefined,
        comment: newComment,
        is_anonymous: isAnonymous,
        parent_review_id: replyingToId || undefined,
      });
    } else {
      // Handle regular review submission
      if (newRating === 0) return;

      await addReview.mutateAsync({
        product_id: productId,
        rating: newRating,
        title: newTitle || undefined,
        comment: newComment || undefined,
        is_anonymous: isAnonymous,
      });
    }

    // Reset form
    setShowForm(false);
    setNewRating(0);
    setNewTitle("");
    setNewComment("");
    setIsAnonymous(false);
    setReplyingToId(null);
    setReplyingToName("");
    setIsReply(false);
  };

  const handleDelete = (reviewId: string) => {
    deleteReview.mutate({ reviewId, productId });
  };

  const handleReply = (reviewId: string, authorName: string) => {
    setReplyingToId(reviewId);
    setReplyingToName(authorName);
    setIsReply(true);
    setShowForm(true);
  };

  // Check if user already reviewed
  const userReview = reviews?.find((r) => r.user_id === user?.id && !r.parent_review_id);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 w-32 bg-muted rounded" />
        <div className="h-24 bg-muted rounded" />
      </div>
    );
  }

  const hasReviews = stats.totalReviews > 0;
  const openWriteForm = () => {
    if (!user) {
      window.location.href = "/login";
      return;
    }
    setIsReply(false);
    setShowForm(true);
  };

  return (
    <div className="space-y-5">
      {!hasReviews ? (
        /* Empty state */
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-yellow-50">
            <Star className="h-5 w-5 text-yellow-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-900">{t('productPdp.reviews.emptyTitle')}</h3>
          <p className="mt-1 text-sm text-gray-500">{t('productPdp.reviews.emptySubtitle')}</p>
          <Button onClick={openWriteForm} className="mt-4" size="sm">
            <MessageSquare className="mr-1.5 h-4 w-4" />
            {t('productPdp.reviews.emptyCta')}
          </Button>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h3 className="text-base md:text-lg font-semibold text-gray-900">{t('productPdp.reviews.comments')}</h3>
            <div className="flex items-center gap-3">
              {user && !userReview && (
                <Button onClick={openWriteForm} variant="outline" size="sm" className="text-xs">
                  <MessageSquare className="h-3 w-3 mr-1" />
                  {t('productPdp.reviews.write')}
                </Button>
              )}
              <button
                onClick={() => setShowAllReviews(true)}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1 transition-colors"
              >
                {t('productPdp.reviews.seeAll')} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Summary + rating bars */}
          <div className="grid gap-5 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-[160px_1fr]">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="text-4xl font-bold text-gray-900">{stats.averageRating.toFixed(1)}</div>
              <StarRating rating={stats.averageRating} size="md" />
              <span className="mt-1 text-[12px] font-medium text-gray-500">
                {t('otherSellers.reviewsCount', { count: stats.totalReviews })}
              </span>
            </div>
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = stats.distribution[star] || 0;
                const pct = stats.totalReviews > 0 ? Math.round((count / stats.totalReviews) * 100) : 0;
                return (
                  <div key={star} className="flex items-center gap-3">
                    <span className="flex w-8 items-center gap-0.5 text-[12px] font-medium text-gray-600">
                      {star}<Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    </span>
                    <Progress value={pct} className="h-2 flex-1" />
                    <span className="w-10 text-right text-[12px] font-medium text-gray-500">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Add Review Modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isReply ? `${replyingToName}` : t("productPdp.reviews.write")}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isReply && (
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Tu calificación *
                </label>
                <StarRating
                  rating={newRating}
                  size="lg"
                  interactive
                  onRatingChange={setNewRating}
                />
              </div>
            )}

            {!isReply && (
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Título (opcional)
                </label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Resumen de tu experiencia"
                  maxLength={100}
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">
                {isReply ? "Tu respuesta" : "Comentario (opcional)"}
              </label>
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={isReply ? "Escribe tu respuesta..." : "Cuéntanos más sobre tu experiencia..."}
                rows={4}
                maxLength={1000}
              />
            </div>

            {!isReply && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="anonymous"
                  checked={isAnonymous}
                  onCheckedChange={(checked) => setIsAnonymous(!!checked)}
                />
                <label htmlFor="anonymous" className="text-sm text-muted-foreground">
                  Publicar como anónimo
                </label>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={!isReply && newRating === 0 || !newComment.trim() || addReview.isPending}
              >
                {addReview.isPending ? (isReply ? "Respondiendo..." : "Publicando...") : (isReply ? "Responder" : "Publicar reseña")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowForm(false);
                  setReplyingToId(null);
                  setReplyingToName("");
                  setIsReply(false);
                }}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {!user && (
        <p className="text-sm text-muted-foreground text-center py-4">
          <a href="/login" className="text-primary hover:underline">
            Inicia sesión
          </a>{" "}
          para dejar una reseña
        </p>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews && reviews.length > 0 && (
          reviews.slice(0, 3).map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              currentUserId={user?.id}
              onDelete={handleDelete}
              onReply={handleReply}
            />
          ))
        )}
      </div>

      {/* Modal de Todos los Comentarios */}
      <Dialog open={showAllReviews} onOpenChange={setShowAllReviews}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold">
              Todos los comentarios ({reviews?.length || 0})
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {reviews && reviews.length > 0 ? (
                reviews.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    currentUserId={user?.id}
                    onReply={handleReply}
                    onDelete={handleDelete}
                  />
                ))
              ) : (
                <div className="text-center py-12">
                  <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">
                    Aún no hay reseñas para este producto
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductReviews;
