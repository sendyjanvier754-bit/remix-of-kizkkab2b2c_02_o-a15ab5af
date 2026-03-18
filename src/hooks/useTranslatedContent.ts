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

  const query = useQuery({
    queryKey: ["translations-batch", entityType, currentLang, ids],
    queryFn: async () => {
      if (!items?.length) return new Map<string, Record<string, string>>();

      // Fetch all cached translations for these entities at once
      const { data: cached } = await (supabase as any)
        .from("content_translations")
        .select("entity_id, field_name, translated_text, source_text_hash")
        .eq("entity_type", entityType)
        .eq("language", currentLang)
        .in("entity_id", items.map((i) => i.id));

      const cachedMap = new Map<
        string,
        Map<string, { text: string; sourceTextHash: string | null }>
      >();
      for (const row of cached || []) {
        if (!cachedMap.has(row.entity_id)) cachedMap.set(row.entity_id, new Map());
        cachedMap.get(row.entity_id)!.set(row.field_name, {
          text: row.translated_text,
          sourceTextHash: row.source_text_hash,
        });
      }

      // Find items missing translations
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

        const itemCache = cachedMap.get(item.id);
        const sourceHashMap = new Map<string, string>();
        for (const [k, v] of Object.entries(cleanFields)) {
          sourceHashMap.set(k, await hashText(v));
        }

        const allCached = Object.keys(cleanFields).every((k) => {
          const cachedEntry = itemCache?.get(k);
          const sourceHash = sourceHashMap.get(k);
          return !!cachedEntry && cachedEntry.sourceTextHash === sourceHash;
        });

        if (!allCached) {
          const missingFields: Record<string, string> = {};
          for (const [k, v] of Object.entries(cleanFields)) {
            const cachedEntry = itemCache?.get(k);
            const sourceHash = sourceHashMap.get(k);
            if (!cachedEntry || cachedEntry.sourceTextHash !== sourceHash) {
              missingFields[k] = v;
            }
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
      }

      // Batch translate missing items (max 10 at a time to avoid timeouts)
      if (toTranslate.length > 0) {
        const batches = [];
        for (let i = 0; i < toTranslate.length; i += 10) {
          batches.push(toTranslate.slice(i, i + 10));
        }

        for (const batch of batches) {
          try {
            const { data } = await supabase.functions.invoke("translate-content", {
              body: { items: batch },
            });

            if (data?.translations) {
              for (const [entityId, fields] of Object.entries(data.translations)) {
                if (!cachedMap.has(entityId)) cachedMap.set(entityId, new Map());
                for (const [field, text] of Object.entries(fields as Record<string, string>)) {
                  cachedMap.get(entityId)!.set(field, {
                    text,
                    sourceTextHash: null,
                  });
                }
              }
            }
          } catch (err) {
            console.warn("Batch translation failed:", err);
          }
        }
      }

      // Build final result map
      const result = new Map<string, Record<string, string>>();
      for (const item of items) {
        const fields = fieldExtractor(item);
        const translated: Record<string, string> = {};
        const itemCache = cachedMap.get(item.id);

        for (const [k, v] of Object.entries(fields)) {
          translated[k] = itemCache?.get(k)?.text || v || "";
        }
        result.set(item.id, translated);
      }

      return result;
    },
    enabled: !isSourceLang && !!items?.length,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
    retry: 1,
  });

  /**
   * Get translated fields for a specific item.
   * Falls back to original text if not yet translated.
   */
  const getTranslated = (item: T): Record<string, string> => {
    if (isSourceLang) {
      const fields = fieldExtractor(item);
      const result: Record<string, string> = {};
      for (const [k, v] of Object.entries(fields)) {
        result[k] = v || "";
      }
      return result;
    }
    return query.data?.get(item.id) || (() => {
      const fields = fieldExtractor(item);
      const result: Record<string, string> = {};
      for (const [k, v] of Object.entries(fields)) result[k] = v || "";
      return result;
    })();
  };

  return {
    getTranslated,
    isTranslating: query.isLoading,
    isSourceLang,
  };
}
