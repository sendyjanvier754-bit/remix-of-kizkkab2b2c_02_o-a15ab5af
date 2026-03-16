import { useState, useRef, useEffect } from "react";
import { Star, Image as ImageIcon, X, UserCircle, CornerDownRight, ChevronDown, ChevronUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { useSubmitReview, useStoreReviews, uploadReviewPhotos } from "@/hooks/useTrendingStores";
import type { StoreReview } from "@/hooks/useTrendingStores";

interface StoreReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  store: {
    id: string;
    name: string;
    logo?: string | null;
  };
  onReviewSubmitted?: () => void;
}

// ─── Star display (read-only) ────────────────────────────────────────────────
const StarDisplay = ({ value }: { value: number }) => (
  <span className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map(i => (
      <Star
        key={i}
        className={`w-3.5 h-3.5 ${i <= Math.round(value) ? "fill-orange-400 text-orange-400" : "text-gray-300"}`}
      />
    ))}
  </span>
);

// ─── Inline reply form ────────────────────────────────────────────────────────
const ReplyForm = ({
  onSubmit,
  onCancel,
}: {
  onSubmit: (comment: string, isAnonymous: boolean) => Promise<void>;
  onCancel: () => void;
}) => {
  const [comment, setComment] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!comment.trim()) return;
    setLoading(true);
    try {
      await onSubmit(comment.trim(), isAnonymous);
      setComment("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2 pl-8 space-y-2">
      <Textarea
        placeholder="Escribe tu respuesta..."
        value={comment}
        onChange={e => setComment(e.target.value)}
        rows={2}
        maxLength={500}
        className="text-sm"
      />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <Checkbox
            checked={isAnonymous}
            onCheckedChange={v => setIsAnonymous(v === true)}
            className="h-3.5 w-3.5"
          />
          Anónimo
        </label>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={loading} className="h-7 text-xs">
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={loading || !comment.trim()}
            className="h-7 text-xs bg-[#071d7f] hover:bg-[#071d7f]/90"
          >
            {loading ? "Enviando..." : "Responder"}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Single review card ───────────────────────────────────────────────────────
const ReviewCard = ({
  review,
  storeId,
  depth = 0,
}: {
  review: StoreReview;
  storeId: string;
  depth?: number;
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { submitReview } = useSubmitReview();
  const queryClient = useQueryClient();
  const [replyOpen, setReplyOpen] = useState(false);
  const [showReplies, setShowReplies] = useState(true);

  const submitReply = async (comment: string, isAnonymous: boolean) => {
    if (!user) {
      toast({ title: "Inicia sesión para responder", variant: "destructive" });
      return;
    }
    await submitReview(storeId, user.id, 1, comment, isAnonymous, [], review.id);
    queryClient.invalidateQueries({ queryKey: ["store-reviews", storeId] });
    queryClient.invalidateQueries({ queryKey: ["store-rating", storeId] });
    toast({ title: "Respuesta enviada" });
    setReplyOpen(false);
  };

  const formattedDate = new Date(review.created_at).toLocaleDateString("es", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const hasReplies = (review.replies?.length ?? 0) > 0;

  return (
    <div className={depth > 0 ? "pl-6 border-l-2 border-gray-100 mt-2" : "border-b border-gray-100 pb-4 last:border-0"}>
      <div className="flex gap-2.5">
        {/* Avatar */}
        {review.user_avatar ? (
          <img src={review.user_avatar} alt={review.user_name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
        ) : (
          <UserCircle className="w-8 h-8 text-gray-400 flex-shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">{review.user_name ?? "Usuario"}</span>
            {depth === 0 && <StarDisplay value={review.rating} />}
            <span className="text-xs text-gray-400 ml-auto">{formattedDate}</span>
          </div>

          {/* Comment */}
          {review.comment && (
            <p className="text-sm text-gray-700 mt-0.5 break-words">{review.comment}</p>
          )}

          {/* Photos */}
          {(review.photos?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {review.photos!.map((url, idx) => (
                <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={url}
                    alt={`foto ${idx + 1}`}
                    className="w-16 h-16 object-cover rounded border border-gray-200 hover:opacity-80 transition-opacity"
                  />
                </a>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 mt-1.5">
            {depth === 0 && (
              <button
                onClick={() => setReplyOpen(v => !v)}
                className="flex items-center gap-1 text-xs text-[#071d7f] hover:underline"
              >
                <CornerDownRight className="w-3.5 h-3.5" />
                Responder
              </button>
            )}
            {hasReplies && depth === 0 && (
              <button
                onClick={() => setShowReplies(v => !v)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
              >
                {showReplies ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {review.replies!.length} {review.replies!.length === 1 ? "respuesta" : "respuestas"}
              </button>
            )}
          </div>

          {/* Inline reply form */}
          {replyOpen && (
            <ReplyForm onSubmit={submitReply} onCancel={() => setReplyOpen(false)} />
          )}
        </div>
      </div>

      {/* Nested replies */}
      {depth === 0 && hasReplies && showReplies && (
        <div className="mt-3 space-y-3">
          {review.replies!.map(reply => (
            <ReviewCard key={reply.id} review={reply} storeId={storeId} depth={1} />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Write review form ────────────────────────────────────────────────────────
const WriteReviewForm = ({
  store,
  onSubmitted,
}: {
  store: StoreReviewModalProps["store"];
  onSubmitted: () => void;
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { submitReview } = useSubmitReview();
  const queryClient = useQueryClient();

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setPhotoFiles(prev => [...prev, ...files]);
    files.forEach(f => {
      const reader = new FileReader();
      reader.onload = ev => setPhotoPreviews(prev => [...prev, ev.target!.result as string]);
      reader.readAsDataURL(f);
    });
    e.target.value = "";
  };

  const removePhoto = (idx: number) => {
    setPhotoFiles(prev => prev.filter((_, i) => i !== idx));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({ title: "Inicia sesión para dejar una reseña", variant: "destructive" });
      return;
    }
    if (rating === 0) {
      toast({ title: "Selecciona una calificación", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      let photoUrls: string[] = [];
      if (photoFiles.length > 0) {
        photoUrls = await uploadReviewPhotos(photoFiles, store.id);
      }
      await submitReview(store.id, user.id, rating, comment || undefined, false, photoUrls);
      queryClient.invalidateQueries({ queryKey: ["store-reviews", store.id] });
      queryClient.invalidateQueries({ queryKey: ["store-rating", store.id] });
      toast({ title: "Reseña enviada", description: "¡Gracias por tu opinión!" });
      onSubmitted();
    } catch (error: any) {
      const msg = error?.message || "No se pudo enviar la reseña. Intenta de nuevo.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const ratingLabels = ["", "Malo", "Regular", "Bueno", "Muy bueno", "Excelente"];

  return (
    <div className="space-y-5 pt-2">
      {/* Star selector */}
      <div className="space-y-1.5">
        <Label>Calificación</Label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              type="button"
              className="p-1 transition-transform hover:scale-110"
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(star)}
            >
              <Star
                className={`w-8 h-8 transition-colors ${
                  star <= (hoverRating || rating)
                    ? "fill-orange-400 text-orange-400"
                    : "text-muted-foreground/30"
                }`}
              />
            </button>
          ))}
          {(hoverRating || rating) > 0 && (
            <span className="ml-2 text-sm text-muted-foreground">{ratingLabels[hoverRating || rating]}</span>
          )}
        </div>
      </div>

      {/* Comment */}
      <div className="space-y-1.5">
        <Label htmlFor="review-comment">Comentario (opcional)</Label>
        <Textarea
          id="review-comment"
          placeholder="Cuéntanos tu experiencia con esta tienda..."
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={3}
          maxLength={500}
        />
        <p className="text-xs text-right text-muted-foreground">{comment.length}/500</p>
      </div>

      {/* Photo upload */}
      <div className="space-y-2">
        <Label>Fotos (opcional)</Label>
        <div className="flex flex-wrap gap-2">
          {photoPreviews.map((src, idx) => (
            <div key={idx} className="relative w-16 h-16">
              <img src={src} alt="" className="w-full h-full object-cover rounded border border-gray-200" />
              <button
                type="button"
                onClick={() => removePhoto(idx)}
                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-600"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-16 h-16 border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors"
          >
            <ImageIcon className="w-5 h-5" />
            <span className="text-xs">Foto</span>
          </button>
        </div>
        {photoFiles.length > 0 && (
          <p className="text-xs text-right text-muted-foreground">{photoFiles.length} foto(s) seleccionada(s)</p>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handlePhotoChange}
        />
      </div>

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={isSubmitting || rating === 0}
        className="w-full bg-orange-500 hover:bg-orange-600"
      >
        {isSubmitting ? "Enviando..." : "Enviar reseña"}
      </Button>
    </div>
  );
};

// ─── Main modal ───────────────────────────────────────────────────────────────
const StoreReviewModal = ({ isOpen, onClose, store, onReviewSubmitted }: StoreReviewModalProps) => {
  const { data: reviews, isLoading, error } = useStoreReviews(isOpen ? store.id : undefined);
  const [activeTab, setActiveTab] = useState<string>("list");

  const totalReviews = reviews?.length ?? 0;
  const avgRating = totalReviews > 0
    ? (reviews!.reduce((s, r) => s + r.rating, 0) / totalReviews).toFixed(1)
    : null;

  const handleWriteSubmitted = () => {
    onReviewSubmitted?.();
    setActiveTab("list");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-3">
            {store.logo ? (
              <img src={store.logo} alt={store.name} className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#071d7f]/10 flex items-center justify-center text-[#071d7f] font-bold text-sm">
                {store.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-base font-bold leading-tight">{store.name}</p>
              {avgRating ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <StarDisplay value={Number(avgRating)} />
                  <span className="text-sm font-semibold text-orange-500">{avgRating}</span>
                  <span className="text-xs text-gray-500">({totalReviews} {totalReviews === 1 ? "reseña" : "reseñas"})</span>
                </div>
              ) : (
                <p className="text-xs text-gray-400 mt-0.5">Sin reseñas aún</p>
              )}
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Modal para leer y escribir reseñas de la tienda {store.name}.
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
          <TabsList className="mx-5 mt-3 shrink-0 grid grid-cols-2 h-9">
            <TabsTrigger value="list" className="text-xs">
              Reseñas {totalReviews > 0 ? `(${totalReviews})` : ""}
            </TabsTrigger>
            <TabsTrigger value="write" className="text-xs">
              Escribir reseña
            </TabsTrigger>
          </TabsList>

          {/* Reviews list */}
          <TabsContent value="list" className="flex-1 overflow-y-auto px-5 pb-5 mt-3 data-[state=inactive]:hidden">
            {isLoading ? (
              <p className="text-sm text-center text-gray-400 py-8">Cargando reseñas...</p>
            ) : error ? (
              <div className="text-center py-10">
                <p className="text-sm text-red-500">No se pudieron cargar las reseñas.</p>
                <p className="text-xs text-gray-500 mt-1 break-words px-2">
                  {error instanceof Error ? error.message : "Verifica que la migración SQL de reseñas esté aplicada correctamente."}
                </p>
              </div>
            ) : totalReviews === 0 ? (
              <div className="text-center py-10">
                <Star className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Aún no hay reseñas.</p>
                <p className="text-xs text-gray-400 mt-1">¡Sé el primero en opinar!</p>
                <Button
                  size="sm"
                  className="mt-4 bg-orange-500 hover:bg-orange-600"
                  onClick={() => setActiveTab("write")}
                >
                  Escribir reseña
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {reviews!.map(review => (
                  <ReviewCard key={review.id} review={review} storeId={store.id} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Write review form */}
          <TabsContent value="write" className="flex-1 overflow-y-auto px-5 pb-5 mt-0 data-[state=inactive]:hidden">
            <WriteReviewForm store={store} onSubmitted={handleWriteSubmitted} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default StoreReviewModal;
