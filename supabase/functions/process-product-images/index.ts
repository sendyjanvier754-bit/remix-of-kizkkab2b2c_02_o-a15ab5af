import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ProcessRequest {
  action: 'create_job' | 'process_item' | 'get_job_status' | 'retry_item';
  jobId?: string;
  itemId?: string;
  items?: Array<{
    skuInterno: string;
    originalUrl: string;
    rowIndex: number;
  }>;
}

interface ProcessResponse {
  success: boolean;
  jobId?: string;
  items?: Array<{
    id: string;
    skuInterno: string;
    status: string;
    publicUrl?: string;
    error?: string;
  }>;
  job?: {
    id: string;
    status: string;
    totalAssets: number;
    processedAssets: number;
    failedAssets: number;
  };
  error?: string;
}

// Helper to generate a clean filename from SKU
function generateStoragePath(skuInterno: string): string {
  // Clean the SKU to create a valid filename
  const cleanSku = skuInterno
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .replace(/_+/g, '_')
    .trim();
  return `products/${cleanSku}.jpg`;
}

// Helper to fetch image with retry logic
async function fetchImageWithRetry(url: string, maxRetries = 3): Promise<ArrayBuffer> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Add headers to mimic browser request for 1688/Alibaba images
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.1688.com/',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType?.startsWith('image/')) {
        throw new Error(`Invalid content type: ${contentType}`);
      }
      
      return await response.arrayBuffer();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`Retry ${i + 1}/${maxRetries} failed for ${url}: ${lastError.message}`);
      
      // Wait before retry with exponential backoff
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  
  throw lastError || new Error('Failed to fetch image');
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify caller is admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: userData, error: userError } = await anonClient.auth.getUser();
    if (userError || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = userData.user.id as string;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check admin role
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    const body: ProcessRequest = await req.json();
    const { action, jobId, itemId, items } = body;
    
    console.log(`Processing action: ${action}`, { jobId, itemId, itemsCount: items?.length });
    
    let response: ProcessResponse;
    
    switch (action) {
      case 'create_job': {
        if (!items || items.length === 0) {
          throw new Error('No items provided for processing');
        }
        
        // Get user from authorization header
        const authHeader = req.headers.get('Authorization');
        let userId: string | null = null;
        
        if (authHeader) {
          const token = authHeader.replace('Bearer ', '');
          const { data: { user } } = await supabase.auth.getUser(token);
          userId = user?.id || null;
        }
        
        // Create job record
        const { data: job, error: jobError } = await supabase
          .from('asset_processing_jobs')
          .insert({
            status: 'pending',
            total_assets: items.length,
            processed_assets: 0,
            failed_assets: 0,
            user_id: userId,
            metadata: { source: '1688', created_from: 'excel_import' }
          })
          .select()
          .single();
        
        if (jobError) {
          throw new Error(`Failed to create job: ${jobError.message}`);
        }
        
        // Create item records
        const itemRecords = items.map(item => ({
          job_id: job.id,
          sku_interno: item.skuInterno,
          original_url: item.originalUrl,
          row_index: item.rowIndex,
          status: 'pending'
        }));
        
        const { data: createdItems, error: itemsError } = await supabase
          .from('asset_processing_items')
          .insert(itemRecords)
          .select();
        
        if (itemsError) {
          throw new Error(`Failed to create items: ${itemsError.message}`);
        }
        
        // Update job status to processing
        await supabase
          .from('asset_processing_jobs')
          .update({ status: 'processing' })
          .eq('id', job.id);
        
        response = {
          success: true,
          jobId: job.id,
          items: createdItems.map(item => ({
            id: item.id,
            skuInterno: item.sku_interno,
            status: item.status
          }))
        };
        break;
      }
      
      case 'process_item': {
        if (!itemId) {
          throw new Error('Item ID is required');
        }
        
        // Get item details
        const { data: item, error: itemError } = await supabase
          .from('asset_processing_items')
          .select('*, asset_processing_jobs(*)')
          .eq('id', itemId)
          .single();
        
        if (itemError || !item) {
          throw new Error(`Item not found: ${itemError?.message}`);
        }
        
        // Update item status to processing
        await supabase
          .from('asset_processing_items')
          .update({ status: 'processing' })
          .eq('id', itemId);
        
        try {
          // Download image from original URL
          console.log(`Downloading image from: ${item.original_url}`);
          const imageBuffer = await fetchImageWithRetry(item.original_url);
          
          // Generate storage path
          const storagePath = generateStoragePath(item.sku_interno);
          console.log(`Uploading to storage: ${storagePath}`);
          
          // Upload to Supabase Storage
          const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(storagePath, imageBuffer, {
              contentType: 'image/jpeg',
              upsert: true
            });
          
          if (uploadError) {
            throw new Error(`Upload failed: ${uploadError.message}`);
          }
          
          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('product-images')
            .getPublicUrl(storagePath);
          
          // Update item with success
          await supabase
            .from('asset_processing_items')
            .update({
              status: 'completed',
              storage_path: storagePath,
              public_url: publicUrl,
              error_message: null
            })
            .eq('id', itemId);
          
          // Update job counters - get current count and increment
          const { data: currentJob } = await supabase
            .from('asset_processing_jobs')
            .select('processed_assets')
            .eq('id', item.job_id)
            .single();
          
          await supabase
            .from('asset_processing_jobs')
            .update({ 
              processed_assets: (currentJob?.processed_assets || 0) + 1 
            })
            .eq('id', item.job_id);
          
          response = {
            success: true,
            items: [{
              id: itemId,
              skuInterno: item.sku_interno,
              status: 'completed',
              publicUrl
            }]
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`Failed to process item ${itemId}: ${errorMessage}`);
          
          // Update item with failure
          await supabase
            .from('asset_processing_items')
            .update({
              status: 'failed',
              error_message: errorMessage,
              retry_count: (item.retry_count || 0) + 1
            })
            .eq('id', itemId);
          
          response = {
            success: false,
            items: [{
              id: itemId,
              skuInterno: item.sku_interno,
              status: 'failed',
              error: errorMessage
            }]
          };
        }
        break;
      }
      
      case 'get_job_status': {
        if (!jobId) {
          throw new Error('Job ID is required');
        }
        
        // Get job with items
        const { data: job, error: jobError } = await supabase
          .from('asset_processing_jobs')
          .select('*')
          .eq('id', jobId)
          .single();
        
        if (jobError || !job) {
          throw new Error(`Job not found: ${jobError?.message}`);
        }
        
        const { data: jobItems } = await supabase
          .from('asset_processing_items')
          .select('*')
          .eq('job_id', jobId)
          .order('row_index', { ascending: true });
        
        // Calculate actual counts
        const completed = jobItems?.filter(i => i.status === 'completed').length || 0;
        const failed = jobItems?.filter(i => i.status === 'failed').length || 0;
        const total = jobItems?.length || 0;
        
        // Update job if all items are processed
        if (completed + failed === total && total > 0) {
          await supabase
            .from('asset_processing_jobs')
            .update({
              status: failed === total ? 'failed' : 'completed',
              processed_assets: completed,
              failed_assets: failed
            })
            .eq('id', jobId);
        }
        
        response = {
          success: true,
          job: {
            id: job.id,
            status: completed + failed === total ? (failed === total ? 'failed' : 'completed') : 'processing',
            totalAssets: total,
            processedAssets: completed,
            failedAssets: failed
          },
          items: jobItems?.map(item => ({
            id: item.id,
            skuInterno: item.sku_interno,
            status: item.status,
            publicUrl: item.public_url,
            error: item.error_message
          }))
        };
        break;
      }
      
      case 'retry_item': {
        if (!itemId) {
          throw new Error('Item ID is required');
        }
        
        // Reset item status to pending
        await supabase
          .from('asset_processing_items')
          .update({
            status: 'pending',
            error_message: null
          })
          .eq('id', itemId);
        
        response = {
          success: true,
          items: [{
            id: itemId,
            skuInterno: '',
            status: 'pending'
          }]
        };
        break;
      }
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
    
  } catch (error) {
    console.error('Error in process-product-images:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
