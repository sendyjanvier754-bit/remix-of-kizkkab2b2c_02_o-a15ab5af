#!/usr/bin/env node
/**
 * Wrapper to load .env and run backfill
 */
import 'dotenv/config';
import https from 'https';
import http from 'http';
import { URL } from 'url';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Environment variables not found');
  console.error('   Need: VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY');
  console.error('   Found:', { SUPABASE_URL, SUPABASE_ANON_KEY: SUPABASE_ANON_KEY ? '***' : undefined });
  process.exit(1);
}

// Default options
const options = {
  entity_type: 'product',
  limit: 50,
  offset: 0,
  language_targets: ['en', 'fr', 'ht'],
  dry_run: true,
};

// Override from command line
const args = process.argv.slice(2);
args.forEach(arg => {
  if (arg === '--no-dry-run') options.dry_run = false;
  if (arg.startsWith('--entity=')) options.entity_type = arg.split('=')[1];
  if (arg.startsWith('--limit=')) options.limit = parseInt(arg.split('=')[1]);
});

console.log('🚀 Backfill Translations');
console.log('========================');
console.log('📧 Supabase URL:', SUPABASE_URL);
console.log('📋 Options:', JSON.stringify(options, null, 2));
console.log('');

async function runBackfill() {
  try {
    const url = new URL(`${SUPABASE_URL}/functions/v1/backfill-translations`);
    const client = url.protocol === 'https:' ? https : http;

    const requestOptions = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    };

    return new Promise((resolve, reject) => {
      const request = client.request(url, requestOptions, (response) => {
        let data = '';

        response.on('data', chunk => {
          data += chunk;
          process.stdout.write('.');
        });

        response.on('end', () => {
          console.log('\n');
          try {
            const result = JSON.parse(data);

            if (response.statusCode === 200 && result.success) {
              console.log('✅ Backfill completado exitosamente!\n');
              console.log('📊 Resumen:');
              console.log(`   Total filas: ${result.summary?.total_rows ?? 0}`);
              console.log(`   Traducidas: ${result.summary?.translated_rows ?? 0}`);
              console.log(`   Saltadas: ${result.summary?.skipped_rows ?? 0}`);
              console.log(`   Errores: ${result.summary?.errors ?? 0}\n`);
              console.log('🌍 Por idioma:');
              Object.entries(result.summary?.translations_by_language ?? {}).forEach(([lang, count]) => {
                console.log(`   ${lang.toUpperCase()}: ${count}`);
              });
            } else {
              console.error('❌ Error:', result.error || result.message || 'Unknown');
            }
            console.log('\n📋 Full response:', JSON.stringify(result, null, 2));
            resolve(result);
          } catch (e) {
            console.error('❌ Parse error:', e.message);
            console.error('Raw:', data.substring(0, 500));
            reject(e);
          }
        });
      });

      request.on('error', err => {
        console.error('❌ Request failed:', err.message);
        reject(err);
      });

      request.write(JSON.stringify(options));
      request.end();
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

runBackfill().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
