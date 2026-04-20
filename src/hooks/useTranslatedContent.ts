import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";

const hashText = async (text: string): Promise<string> => {
  const normalized = text.trim();
  const data = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

/**
 * Hook to translate database content based on the current i18n language.
 * 
 * Usage:
 *   const { translated } = useTranslatedContent('category', category.id, {
 *     name: category.name,
 *     description: category.description
 *   });
 *   // translated.name → translated category name
 * 
 * For the source language (es), returns the original fields without any API call.
 */
export function useTranslatedContent(
  entityType: string,
  entityId: string | undefined | null,
  fields: Record<string, string | null | undefined>,
  options?: { enabled?: boolean; sourceLang?: string }
) {
  const { i18n } = useTranslation();
  const currentLang = i18n.language?.substring(0, 2) || "es";
  const sourceLang = options?.sourceLang || "es";
  const enabled = options?.enabled !== false && !!entityId && currentLang !== sourceLang;

  const cleanFields: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value) cleanFields[key] = value;
  }

  const fieldKeys = Object.keys(cleanFields).sort().join(",");

  const query = useQuery({
    queryKey: ["translation", entityType, entityId, currentLang, fieldKeys],
    queryFn: async () => {
      if (!entityId) return cleanFields;

      // 1. Try cached translations from DB first
      const { data: cached } = await (supabase as any)
        .from("content_translations")
        .select("field_name, translated_text, source_text_hash")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .eq("language", currentLang);

      const cachedMap = new Map<
        string,
        { text: string; sourceTextHash: string | null }
      >(
        (cached || []).map((c: any) => [
          c.field_name,
          {
            text: c.translated_text,
            sourceTextHash: c.source_text_hash,
          },
        ])
      );

      const sourceHashMap = new Map<string, string>();
      for (const [key, value] of Object.entries(cleanFields)) {
        sourceHashMap.set(key, await hashText(value));
      }

      // Check if all fields are cached
      const allCached = Object.keys(cleanFields).every((k) => {
        const cachedEntry = cachedMap.get(k);
        const sourceHash = sourceHashMap.get(k);
        return !!cachedEntry && cachedEntry.sourceTextHash === sourceHash;
      });
      if (allCached) {
        const result: Record<string, string> = {};
        for (const key of Object.keys(cleanFields)) {
          result[key] = cachedMap.get(key)?.text || cleanFields[key];
        }
        return result;
      }

      // 2. Call edge function to translate missing fields
      const missingFields: Record<string, string> = {};
      for (const [key, value] of Object.entries(cleanFields)) {
        const cachedEntry = cachedMap.get(key);
        const sourceHash = sourceHashMap.get(key);
        if (!cachedEntry || cachedEntry.sourceTextHash !== sourceHash) {
          missingFields[key] = value;
        }
      }

      try {
        const { data, error } = await supabase.functions.invoke("translate-content", {
          body: {
            entity_type: entityType,
            entity_id: entityId,
            fields: missingFields,
            source_language: sourceLang,
            target_language: currentLang,
          },
        });

        if (error) {
          console.warn("Translation edge function error:", error);
          return cleanFields;
        }

        const translated = data?.translations?.[entityId] || {};
        const result: Record<string, string> = {};
        for (const key of Object.keys(cleanFields)) {
          const cachedEntry = cachedMap.get(key);
          const sourceHash = sourceHashMap.get(key);
          const validCached = cachedEntry && cachedEntry.sourceTextHash === sourceHash;
          result[key] = (validCached ? cachedEntry?.text : undefined) || translated[key] || cleanFields[key];
        }
        return result;
      } catch (err) {
        console.warn("Translation failed, using original:", err);
        return cleanFields;
      }
    },
    enabled,
    staleTime: 1000 * 60 * 60, // 1 hour cache
    gcTime: 1000 * 60 * 60 * 24, // Keep in cache 24h
    retry: 1,
  });

  // If source language, return originals directly
  if (!enabled) {
    return {
      translated: cleanFields,
      isTranslating: false,
      isSourceLang: currentLang === sourceLang,
    };
  }

  return {
    translated: query.data || cleanFields,
    isTranslating: query.isLoading,
    isSourceLang: false,
  };
}

/**
 * Batch translate multiple entities at once.
 * Useful for lists (e.g., category sidebar, product grids).
 */
export function useTranslatedList<T extends { id: string }>(
  entityType: string,
  items: T[] | undefined,
  fieldExtractor: (item: T) => Record<string, string | null | undefined>,
  options?: { sourceLang?: string }
) {
  const { i18n } = useTranslation();
  const currentLang = i18n.language?.substring(0, 2) || "es";
  const sourceLang = options?.sourceLang || "es";
  const isSourceLang = currentLang === sourceLang;

  const ids = items?.map((i) => i.id).sort().join(",") || "";

  // ── Step 1: fast DB-only query (returns immediately with whatever is cached) ──
  const cacheQuery = useQuery({
    queryKey: ["translations-cache", entityType, currentLang, ids],
    queryFn: async () => {
      if (!items?.length) return new Map<string, Record<string, string>>();
      const { data: cached } = await (supabase as any)
        .from("content_translations")
        .select("entity_id, field_name, translated_text")
        .eq("entity_type", entityType)
        .eq("language", currentLang)
        .in("entity_id", items.map((i) => i.id));

      const result = new Map<string, Record<string, string>>();
      for (const row of cached || []) {
        if (!result.has(row.entity_id)) result.set(row.entity_id, {});
        result.get(row.entity_id)![row.field_name] = row.translated_text;
      }
      return result;
    },
    enabled: !isSourceLang && !!items?.length,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
  });

  // ── Step 2: background fill — call edge function for missing items ──
  useQuery({
    queryKey: ["translations-fill", entityType, currentLang, ids],
    queryFn: async () => {
      if (!items?.length) return null;

      const cacheData = cacheQuery.data;
      const toTranslate: Array<{
        entity_type: string;
        entity_id: string;
        fields: Record<string, string>;
        target_language: string;
        source_language: string;
      }> = [];

      for (const item of items) {
        const fields = fieldExtractor(item);
        const cleanFields: Record<string, string> = {};
        for (const [k, v] of Object.entries(fields)) {
          if (v) cleanFields[k] = v;
        }
        if (Object.keys(cleanFields).length === 0) continue;

        const itemCache = cacheData?.get(item.id) || {};
        const missingFields: Record<string, string> = {};
        for (const [k, v] of Object.entries(cleanFields)) {
          if (!itemCache[k]) missingFields[k] = v;
        }
        if (Object.keys(missingFields).length > 0) {
          toTranslate.push({
            entity_type: entityType,
            entity_id: item.id,
            fields: missingFields,
            target_language: currentLang,
            source_language: sourceLang,
          });
        }
      }

      if (toTranslate.length === 0) return null;

      // Translate in batches of 10
      for (let i = 0; i < toTranslate.length; i += 10) {
        const batch = toTranslate.slice(i, i + 10);
        try {
          await supabase.functions.invoke("translate-content", {
            body: { items: batch },
          });
        } catch (err) {
          console.warn("Batch translation failed:", err);
        }
      }

      // Refetch DB cache to get the new translations
      await cacheQuery.refetch();
      return null;
    },
    enabled: !isSourceLang && !!items?.length && !cacheQuery.isLoading,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
    retry: 0,
  });

  /**
   * Get translated fields for a specific item.
   * Falls back to original text per-field if not yet translated.
   */
  const getTranslated = (item: T): Record<string, string> => {
    const fields = fieldExtractor(item);
    const fallback: Record<string, string> = {};
    for (const [k, v] of Object.entries(fields)) fallback[k] = v || "";

    if (isSourceLang) return fallback;

    const translated = cacheQuery.data?.get(item.id);
    if (!translated) return fallback;

    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(fallback)) {
      result[k] = translated[k] || v;
    }
    return result;
  };

  return {
    getTranslated,
    isTranslating: cacheQuery.isLoading,
    isSourceLang,
  };
}
