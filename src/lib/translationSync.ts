import { supabase } from '@/integrations/supabase/client';

export const AUTO_TRANSLATION_TARGET_LANGUAGES = ['en', 'fr', 'ht'] as const;

type TranslatableFields = Record<string, string | null | undefined>;

interface TranslationItem {
  entity_type: string;
  entity_id: string;
  fields: Record<string, string>;
  source_language?: string;
  target_language: string;
}

const cleanFields = (fields: TranslatableFields): Record<string, string> => {
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === 'string' && value.trim().length > 0) {
      output[key] = value.trim();
    }
  }
  return output;
};

export const syncEntityTranslations = async (
  entityType: string,
  entityId: string | null | undefined,
  fields: TranslatableFields,
  sourceLanguage = 'es'
): Promise<void> => {
  if (!entityId) return;

  const normalizedFields = cleanFields(fields);
  if (Object.keys(normalizedFields).length === 0) return;

  const items: TranslationItem[] = AUTO_TRANSLATION_TARGET_LANGUAGES.map((targetLanguage) => ({
    entity_type: entityType,
    entity_id: entityId,
    fields: normalizedFields,
    source_language: sourceLanguage,
    target_language: targetLanguage,
  }));

  try {
    const { error } = await supabase.functions.invoke('translate-content', {
      body: { items },
    });

    if (error) {
      console.warn(`[translationSync] translate-content error for ${entityType}:${entityId}`, error);
    }
  } catch (err) {
    console.warn(`[translationSync] unexpected translation error for ${entityType}:${entityId}`, err);
  }
};

export const syncBatchEntityTranslations = async (
  entities: Array<{
    entityType: string;
    entityId: string;
    fields: TranslatableFields;
  }>,
  sourceLanguage = 'es',
  batchSize = 10
): Promise<void> => {
  const normalizedEntities = entities
    .map((entity) => ({
      entityType: entity.entityType,
      entityId: entity.entityId,
      fields: cleanFields(entity.fields),
    }))
    .filter((entity) => Object.keys(entity.fields).length > 0);

  if (normalizedEntities.length === 0) return;

  const translationItems: TranslationItem[] = normalizedEntities.flatMap((entity) =>
    AUTO_TRANSLATION_TARGET_LANGUAGES.map((targetLanguage) => ({
      entity_type: entity.entityType,
      entity_id: entity.entityId,
      fields: entity.fields,
      source_language: sourceLanguage,
      target_language: targetLanguage,
    }))
  );

  for (let i = 0; i < translationItems.length; i += batchSize) {
    const slice = translationItems.slice(i, i + batchSize);

    try {
      const { error } = await supabase.functions.invoke('translate-content', {
        body: { items: slice },
      });

      if (error) {
        console.warn('[translationSync] translate-content batch error', {
          index: i,
          size: slice.length,
          error,
        });
      }
    } catch (err) {
      console.warn('[translationSync] unexpected batch translation error', {
        index: i,
        size: slice.length,
        err,
      });
    }
  }
};
