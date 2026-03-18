#!/usr/bin/env node

/**
 * Backfill Translations Script
 * Uso: node scripts/backfill-translations.js [options]
 * 
 * Ejemplos:
 *   node scripts/backfill-translations.js --entity=product --limit=50 --dry-run
 *   node scripts/backfill-translations.js --entity=all --dry-run=false
 *   node scripts/backfill-translations.js --entity=category --limit=100 --offset=50
 */

const https = require('https');
const http = require('http');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  entity_type: 'product',
  limit: 50,
  offset: 0,
  language_targets: ['en', 'fr', 'ht'],
  dry_run: true,
};

args.forEach(arg => {
  if (arg.startsWith('--')) {
    const [key, value] = arg.substring(2).split('=');
    if (key === 'entity') {
      options.entity_type = value;
    } else if (key === 'limit') {
      options.limit = parseInt(value);
    } else if (key === 'offset') {
      options.offset = parseInt(value);
    } else if (key === 'dry-run') {
      options.dry_run = value !== 'false';
    } else if (key === 'languages') {
      options.language_targets = value.split(',');
    }
  }
});

// Get Supabase credentials from environment
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables are required');
  console.error('   Set them in your .env.local file');
  process.exit(1);
}

const url = new URL(`${SUPABASE_URL}/functions/v1/backfill-translations`);
const isHttps = url.protocol === 'https:';
const client = isHttps ? https : http;

const requestOptions = {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  },
};

const payload = JSON.stringify(options);

console.log('🚀 Starting backfill translations...');
console.log('📋 Configuration:', options);
console.log('');

const request = client.request(url, requestOptions, (response) => {
  let data = '';

  response.on('data', (chunk) => {
    data += chunk;
  });

  response.on('end', () => {
    try {
      const result = JSON.parse(data);

      if (response.statusCode === 200 && result.success) {
        console.log('✅ Backfill completed successfully!');
        console.log('');
        console.log('📊 Summary:');
        console.log(`   Total rows: ${result.summary.total_rows}`);
        console.log(`   Translated: ${result.summary.translated_rows}`);
        console.log(`   Skipped: ${result.summary.skipped_rows}`);
        console.log(`   Errors: ${result.summary.errors}`);
        console.log('');
        console.log('🌍 Translations by language:');
        Object.entries(result.summary.translations_by_language).forEach(([lang, count]) => {
          console.log(`   ${lang.toUpperCase()}: ${count}`);
        });
        console.log('');
        console.log('📋 Details by entity:');
        Object.entries(result.details).forEach(([entity, stats]) => {
          console.log(`   ${entity}: ${stats.inserted_or_updated} updated, ${stats.skipped} skipped`);
        });
        console.log('');
        console.log('✨ Backfill job finished!');
      } else {
        console.error('❌ Error:', result.error || result.message || 'Unknown error');
        console.error('Full response:', result);
      }
    } catch (error) {
      console.error('❌ Failed to parse response:', error);
      console.error('Raw response:', data);
    }
  });
});

request.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
  console.error('   Make sure Supabase is running and accessible at:', SUPABASE_URL);
  process.exit(1);
});

request.write(payload);
request.end();
