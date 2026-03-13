import { supabase } from "@/integrations/supabase/client";
import EmbeddingService from "@/services/ai/embeddingService";
import type { Product } from "@/types/products";

interface SearchResult {
  id: string;
  nombre: string;
  imagen_principal: string | null;
  precio_b2b: number | null;
  similarity?: number;
}

export const searchProductsByImage = async (file: File): Promise<Product[]> => {
  try {
    console.log("Processing image for search...");
    
    // Create a local URL for the image
    const imageUrl = URL.createObjectURL(file);
    
    // Generate embedding locally in the browser
    const embedding = await EmbeddingService.generateImageEmbedding(imageUrl);
    
    // Clean up the object URL
    URL.revokeObjectURL(imageUrl);
    
    console.log("Embedding generated, length:", embedding.length);

    // Convert embedding array to pgvector format string: '[0.1, 0.2, ...]'
    const embeddingString = `[${embedding.join(',')}]`;

    // Call Supabase RPC to find similar products
    const { data: products, error } = await (supabase as any).rpc('match_products', {
      query_embedding: embeddingString,
      match_threshold: 0.3,
      match_count: 12
    });

    if (error) {
      console.error('Error searching products:', error);
      // Fallback to mock if RPC fails
      console.warn("Falling back to mock search due to RPC error");
      return mockSearch();
    }

    // Return products as-is, caller should handle partial data
    return (products as any[] || []) as Product[];
  } catch (err) {
    console.error("Client-side AI error:", err);
    // Fallback to mock for demo purposes if model fails
    return mockSearch();
  }
};

// Fallback mock function
const mockSearch = async (): Promise<Product[]> => {
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .limit(8);
    
  return (products?.sort(() => 0.5 - Math.random()) || []) as unknown as Product[];
};
