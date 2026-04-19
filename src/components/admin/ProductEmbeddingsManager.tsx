import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Play, RefreshCw, CheckCircle, XCircle, Image, Cpu } from 'lucide-react';
import { useProductEmbeddings } from '@/hooks/useProductEmbeddings';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface Stats {
  total: number;
  withEmbedding: number;
  missing: number;
}

const ProductEmbeddingsManager = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Stats>({ total: 0, withEmbedding: 0, missing: 0 });
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const { isProcessing, progress, errors, generateEmbeddingsForProducts, getEmbeddingStats } = useProductEmbeddings();

  const loadStats = async () => {
    setIsLoadingStats(true);
    try {
      const data = await getEmbeddingStats();
      setStats(data);
    } catch (err) {
      console.error('Error loading stats:', err);
      toast.error(t('toasts.errorLoadingStats'));
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleGenerateAll = async () => {
    toast.info(t('toasts.loadingClipModel'));
    try {
      const result = await generateEmbeddingsForProducts(false);
      if (result) {
        toast.success(result.message);
        loadStats();
      }
    } catch (err) {
      toast.error(t('toasts.errorGeneratingEmbeddings'));
    }
  };

  const handleGenerateMissing = async () => {
    toast.info(t('toasts.loadingClipModel'));
    try {
      const result = await generateEmbeddingsForProducts(true);
      if (result) {
        toast.success(result.message);
        loadStats();
      }
    } catch (err) {
      toast.error(t('toasts.errorGeneratingEmbeddings'));
    }
  };

  const progressPercent = progress.total > 0 
    ? Math.round((progress.processed / progress.total) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Cpu className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Generador de Embeddings de Imágenes</CardTitle>
              <CardDescription>
                Genera vectores de similitud para la búsqueda por imagen usando IA (CLIP)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-muted rounded-lg text-center">
              <div className="text-2xl font-bold">
                {isLoadingStats ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : stats?.total || 0}
              </div>
              <div className="text-sm text-muted-foreground">Total Productos</div>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">
                {isLoadingStats ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : stats?.withEmbedding || 0}
              </div>
              <div className="text-sm text-muted-foreground">Con Embedding</div>
            </div>
            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-center">
              <div className="text-2xl font-bold text-orange-600">
                {isLoadingStats ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : stats?.missing || 0}
              </div>
              <div className="text-sm text-muted-foreground">Pendientes</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={handleGenerateMissing}
              disabled={isProcessing || stats?.missing === 0}
              className="flex-1"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Generar Pendientes ({stats?.missing || 0})
            </Button>
            <Button
              variant="outline"
              onClick={handleGenerateAll}
              disabled={isProcessing}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerar Todos
            </Button>
            <Button
              variant="ghost"
              onClick={loadStats}
              disabled={isProcessing || isLoadingStats}
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingStats ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Progress */}
          {isProcessing && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Procesando: <span className="font-medium text-foreground">{progress.currentProduct}</span>
                </span>
                <span>{progress.processed} / {progress.total}</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
              <div className="flex gap-4 text-sm">
                <Badge variant="outline" className="gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  {progress.success} exitosos
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <XCircle className="h-3 w-3 text-red-500" />
                  {progress.failed} fallidos
                </Badge>
              </div>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                <ScrollArea className="h-32">
                  <ul className="text-sm space-y-1">
                    {errors.map((error, i) => (
                      <li key={i}>• {error}</li>
                    ))}
                  </ul>
                </ScrollArea>
              </AlertDescription>
            </Alert>
          )}

          {/* Info */}
          <Alert>
            <Image className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>¿Cómo funciona?</strong> El modelo CLIP se ejecuta en tu navegador (sin costos de API). 
              Cada producto con imagen se procesa para generar un vector de 512 dimensiones que permite 
              búsquedas por similitud visual. El proceso puede tomar varios minutos para catálogos grandes.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductEmbeddingsManager;
