import { supabase } from '@/integrations/supabase/client';
import html2pdf from 'html2pdf.js';

interface CatalogProduct {
  id: string;
  sku: string;
  nombre: string;
  descripcion: string | null;
  precio_venta: number;
  images: string[];
  variants?: Array<{
    id: string;
    sku: string;
    color?: string;
    size?: string;
    image?: string;
  }>;
  store_slug: string;
  store_name: string;
}

interface PDFGeneratorOptions {
  products: CatalogProduct[];
  storeId: string;
  storeName: string;
  storeLogo?: string;
  storeSlug: string;
  primaryColor?: string;
  showQR?: boolean;
  trackingEnabled?: boolean;
}

// Generate tracking URL for product
const getProductLink = (product: CatalogProduct, storeSlug: string, variantId?: string) => {
  const baseUrl = window.location.origin;
  let url = `${baseUrl}/tienda/${storeSlug}/producto/${product.id}`;
  if (variantId) {
    url += `?variant=${variantId}`;
  }
  return url;
};

// Generate QR code as data URL using QR Server API
const generateQRCode = async (url: string, size: number = 150): Promise<string> => {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`;
  return qrUrl;
};

// Format currency for display
const formatPrice = (price: number): string => {
  return `$${price.toFixed(2)}`;
};

// Helper: Convert image URL to base64 data URL
const imageToBase64 = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url, { mode: 'cors' });
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting image to base64:', error);
    // Return placeholder if conversion fails
    return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect fill="%23ddd" width="400" height="400"/%3E%3C/svg%3E';
  }
};

// Generate Interactive PDF Catalog - Ultra-Minimalist Design
// ONLY includes: Main Image, Variant Thumbnails, Price, Buy Button
// NO title, NO description as per design specs
export const generatePDFCatalog = async (options: PDFGeneratorOptions): Promise<string> => {
  const { products, storeId, storeName, storeLogo, storeSlug, primaryColor = '#8B5CF6', showQR = true, trackingEnabled = true } = options;
  
  const trackingBaseUrl = trackingEnabled 
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-catalog-click`
    : null;

  // Convert store logo to base64 if exists
  const storeLogoBase64 = storeLogo ? await imageToBase64(storeLogo) : null;

  // Generate HTML content for PDF
  let productsHtml = '';
  
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const mainImage = product.images[0] || '/placeholder.svg';
    const productLink = getProductLink(product, storeSlug);
    // QR Code removed as per requirements
    
    // Convert main image to base64 for reliable PDF rendering
    const mainImageBase64 = await imageToBase64(mainImage);
    
    // Generate variant thumbnails HTML - circular mini thumbnails with inline styles
    let variantThumbnails = '';
    if (product.variants && product.variants.length > 1) {
      variantThumbnails = `
        <div class="variants-row" style="text-align: center; padding: 6px 8px; background: #ffffff; height: 36px; box-sizing: border-box;">
          ${product.variants.slice(0, 8).map((v, idx) => `
            <button class="variant-thumb ${idx === 0 ? 'active' : ''}" 
                    data-variant-idx="${idx}" 
                    data-variant-image="${v.image || mainImage}"
                    data-variant-id="${v.id}"
                    onclick="switchVariant(this, '${productLink}${v.id ? `?variant=${v.id}` : ''}')"
                    title="${v.color || v.size || 'Variante'}"
                    style="display: inline-block; width: 24px; height: 24px; border-radius: 50%; border: 2px solid ${idx === 0 ? primaryColor : 'transparent'}; padding: 0; overflow: hidden; background: none; cursor: pointer; margin: 0 2px; vertical-align: middle;">
              <img src="${v.image || mainImage}" alt="" width="24" height="24" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" />
            </button>
          `).join('')}
        </div>
      `;
    }

    // Tracking pixel (1x1 transparent gif)
    const trackingPixel = trackingBaseUrl 
      ? `<img src="${trackingBaseUrl}?sid=${storeId}&pid=${product.id}&src=pdf_catalog" width="1" height="1" style="position:absolute;opacity:0;" />`
      : '';

    // Check if this is the 6th product (end of page) for page break
    const pageBreakStyle = (i + 1) % 6 === 0 && i < products.length - 1 ? ' page-break-after: always;' : '';

    // Ultra-minimalist product card: Image + Price Badge with border
    productsHtml += `
      <div class="product-card" data-product-id="${product.id}" style="float: left; width: 373px; height: 310px; margin: 0 6px 12px 6px; background: #ffffff; border: 3px solid #071d7f; border-radius: 8px; overflow: hidden; box-sizing: border-box; page-break-inside: avoid;${pageBreakStyle}">
        ${trackingPixel}
        <a href="${productLink}" class="image-link" target="_blank" style="display: block; text-decoration: none; padding: 10px 10px 6px 10px;">
          <div class="product-image-container" style="width: 180px; height: 180px; margin: 0 auto; background: #f0f0f0; border-radius: 8px; overflow: hidden;">
            <img class="main-image" src="${mainImageBase64}" alt="${product.nombre}" width="180" height="180" style="width: 180px; height: 180px; object-fit: cover; display: block;" crossorigin="anonymous" />
          </div>
        </a>
        ${variantThumbnails}
        <div class="product-footer" style="padding: 10px 8px; background: #ffffff; text-align: center; height: 60px; box-sizing: border-box; display: flex; align-items: center; justify-content: center;">
          <div class="product-price" style="padding: 8px 16px; background: #071d7f; color: #ffffff; font-size: 20px; font-weight: 800; border-radius: 24px; letter-spacing: -0.3px; text-align: center; white-space: nowrap;">${formatPrice(product.precio_venta)}</div>
        </div>
      </div>
    `;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${storeName}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;700;800&display=swap');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
          font-family: 'Inter', sans-serif;
          background: #ffffff;
          color: #0a0a0a;
          padding: 0;
          margin: 0;
          width: 794px;
          max-width: 794px;
        }
        
        .catalog-header {
          display: block;
          text-align: center;
          padding: 16px 10px;
          border-bottom: 4px solid #071d7f;
          background: #f5f5f5;
          height: 80px;
          box-sizing: border-box;
          margin-bottom: 0;
        }
        
        .store-logo {
          display: inline-block;
          width: 42px;
          height: 42px;
          border-radius: 50%;
          object-fit: cover;
          vertical-align: middle;
          margin-right: 10px;
        }
        
        .store-name {
          display: inline-block;
          font-size: 24px;
          font-weight: 900;
          letter-spacing: -0.5px;
          color: #071d7f;
          vertical-align: middle;
          text-transform: uppercase;
        }
        
        .products-grid {
          width: 794px;
          padding: 20px 0 12px 0;
          box-sizing: border-box;
        }
        
        .products-grid::after {
          content: "";
          display: block;
          clear: both;
        }
        
        .product-card {
          float: left;
          width: 373px;
          height: 310px;
          margin: 0 6px 12px 6px;
          background: #ffffff;
          border: 3px solid #071d7f;
          border-radius: 8px;
          overflow: hidden;
          position: relative;
          page-break-inside: avoid;
          break-inside: avoid;
          box-sizing: border-box;
        }
        
        .product-card:nth-child(2n+1) {
          margin-left: 12px;
        }
        
        .product-card:nth-child(2n) {
          margin-right: 12px;
        }
        
        /* Force page break after every 6 products (3 rows × 2 cols) */
        .product-card:nth-child(6n) {
          page-break-after: always;
          break-after: page;
        }
        
        .image-link {
          display: block;
          text-decoration: none;
          width: 100%;
          padding: 10px 10px 6px 10px;
          box-sizing: border-box;
        }
        
        .product-image-container {
          width: 180px;
          height: 180px;
          max-width: 180px;
          max-height: 180px;
          overflow: hidden;
          background: #f0f0f0;
          margin: 0 auto;
          border-radius: 8px;
        }
        
        .main-image {
          width: 180px !important;
          height: 180px !important;
          max-width: 180px !important;
          max-height: 180px !important;
          min-width: 180px !important;
          min-height: 180px !important;
          object-fit: cover;
          display: block;
        }
        
        /* Variant Thumbnails - Circular mini swatches */
        .variants-row {
          display: block;
          text-align: center;
          padding: 6px 8px;
          background: #ffffff;
          height: 36px;
          box-sizing: border-box;
        }
        
        .variant-thumb {
          display: inline-block;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 2px solid transparent;
          padding: 0;
          overflow: hidden;
          background: none;
          cursor: pointer;
          margin: 0 2px;
          vertical-align: middle;
        }
        
        .variant-thumb.active {
          border-color: ${primaryColor};
        }
        
        .variant-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 50%;
        }
        
        /* Footer: Price Badge */
        .product-footer {
          padding: 10px 8px;
          background: #ffffff;
          text-align: center;
          height: 60px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .product-price {
          padding: 8px 16px;
          background: #071d7f;
          color: #ffffff;
          font-size: 20px;
          font-weight: 800;
          border-radius: 24px;
          letter-spacing: -0.3px;
          text-align: center;
          white-space: nowrap;
        }
        
        @media print {
          body {
            width: 794px !important;
          }
          .products-grid {
            width: 794px !important;
          }
          .products-grid::after {
            content: "" !important;
            display: block !important;
            clear: both !important;
          }
          .product-card { 
            float: left !important;
            break-inside: avoid !important; 
            page-break-inside: avoid !important;
            -webkit-column-break-inside: avoid !important;
            width: 373px !important;
            height: 310px !important;
            border: 3px solid #071d7f !important;
            background: #ffffff !important;
          }
          .product-footer {
            padding: 10px 8px !important;
            text-align: center !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          
          .product-price { 
            background: #071d7f !important;
            color: #ffffff !important;
            padding: 8px 16px !important;
            text-align: center !important;
            white-space: nowrap !important;
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact;
            color-adjust: exact;
          }
          .catalog-header {
            background: #f5f5f5 !important;
            border-bottom: 4px solid #071d7f !important;
            height: 80px !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            color-adjust: exact;
          }
          .store-name {
            color: #071d7f !important;
            font-size: 24px !important;
            font-weight: 900 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
        
        @page {
          size: A4;
          margin: 0.5cm;
        }
      </style>
      <script>
        function switchVariant(thumb, link) {
          const card = thumb.closest('.product-card');
          const mainImg = card.querySelector('.main-image');
          const imageLink = card.querySelector('.image-link');
          const newSrc = thumb.dataset.variantImage;
          
          // Update active state
          card.querySelectorAll('.variant-thumb').forEach(t => t.classList.remove('active'));
          thumb.classList.add('active');
          
          // Smooth image transition
          mainImg.style.opacity = '0.5';
          setTimeout(() => {
            mainImg.src = newSrc;
            mainImg.style.opacity = '1';
          }, 100);
          
          // Update link to include variant
          imageLink.href = link;
        }
      </script>
    </head>
    <body>
      <header class="catalog-header" style="display: block; text-align: center; padding: 16px 10px; border-bottom: 4px solid #071d7f; background: #f5f5f5; height: 80px; box-sizing: border-box; margin-bottom: 0;">
        ${storeLogoBase64 ? `<img src="${storeLogoBase64}" alt="${storeName}" class="store-logo" width="42" height="42" style="display: inline-block; width: 42px; height: 42px; border-radius: 50%; object-fit: cover; vertical-align: middle; margin-right: 10px;" crossorigin="anonymous" />` : ''}
        <span class="store-name" style="display: inline-block; font-size: 24px; font-weight: 900; letter-spacing: -0.5px; color: #071d7f; vertical-align: middle; text-transform: uppercase;">${storeName}</span>
      </header>
      
      <main class="products-grid" style="width: 794px; padding: 20px 0 12px 0; box-sizing: border-box;">
        ${productsHtml}
        <div style="clear: both;"></div>
      </main>
    </body>
    </html>
  `;

  return htmlContent;
};

// Open PDF catalog in new window for printing
export const openPDFCatalog = async (options: PDFGeneratorOptions) => {
  // Open window BEFORE any await — browsers block window.open after async gaps
  const printWindow = window.open('', '_blank');

  const htmlContent = await generatePDFCatalog(options);

  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
  
  return htmlContent;
};

// Generate PDF file (Blob) from HTML for storage upload
export const generatePDFBlob = async (options: PDFGeneratorOptions): Promise<{ pdfBlob: Blob; htmlContent: string }> => {
  const htmlContent = await generatePDFCatalog(options);
  
  // Create an iframe to properly load the HTML content
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '0';
  iframe.style.left = '0';
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.zIndex = '9999';
  iframe.style.border = 'none';
  iframe.style.backgroundColor = '#ffffff';
  
  document.body.appendChild(iframe);

  try {
    // Load HTML into iframe
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) throw new Error('Cannot access iframe document');
    
    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();
    
    // Wait for all images to load
    const images = Array.from(iframeDoc.querySelectorAll('img'));
    await Promise.all(
      images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = () => resolve(null);
          img.onerror = () => resolve(null);
          setTimeout(() => resolve(null), 5000);
        });
      })
    );
    
    // Additional wait to ensure rendering
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Configure html2pdf options optimized for images
    const opt = {
      margin: [0.5, 0.5, 0.5, 0.5],
      filename: `${options.storeName}_catalog.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        letterRendering: true,
        imageTimeout: 0,
        backgroundColor: '#ffffff',
        width: 794,
        windowWidth: 794,
        onclone: (clonedDoc: Document) => {
          // Ensure floats are preserved in cloned document
          const cards = clonedDoc.querySelectorAll('.product-card');
          cards.forEach((card: Element) => {
            (card as HTMLElement).style.float = 'left';
            (card as HTMLElement).style.display = 'block';
          });
          
          // Force flexbox centering on footers for proper PDF rendering
          const footers = clonedDoc.querySelectorAll('.product-footer');
          footers.forEach((footer: Element) => {
            (footer as HTMLElement).style.display = 'flex';
            (footer as HTMLElement).style.alignItems = 'center';
            (footer as HTMLElement).style.justifyContent = 'center';
            (footer as HTMLElement).style.textAlign = 'center';
          });
          
          // Force text centering on price badges
          const prices = clonedDoc.querySelectorAll('.product-price');
          prices.forEach((price: Element) => {
            (price as HTMLElement).style.textAlign = 'center';
            (price as HTMLElement).style.display = 'block';
          });
        }
      },
      jsPDF: { 
        unit: 'cm', 
        format: 'a4', 
        orientation: 'portrait',
        compress: true
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    // Use the iframe's body
    const bodyElement = iframeDoc.body;

    // Generate PDF and get the blob
    const pdfBlob = await html2pdf()
      .set(opt)
      .from(bodyElement)
      .output('blob');

    return { pdfBlob, htmlContent };
  } finally {
    // Clean up
    document.body.removeChild(iframe);
  }
};

// Generate PDF catalog, download it, AND return blob for storage upload
export const generateAndDownloadPDFCatalog = async (options: PDFGeneratorOptions): Promise<{ pdfBlob: Blob; htmlContent: string }> => {
  const htmlContent = await generatePDFCatalog(options);
  
  // Create an iframe to properly load the HTML content
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '0';
  iframe.style.left = '0';
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.zIndex = '9999';
  iframe.style.border = 'none';
  iframe.style.backgroundColor = '#ffffff';
  
  document.body.appendChild(iframe);

  try {
    // Load HTML into iframe
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) throw new Error('Cannot access iframe document');
    
    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();
    
    // Wait for all images to load
    const images = Array.from(iframeDoc.querySelectorAll('img'));
    await Promise.all(
      images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = () => resolve(null);
          img.onerror = () => resolve(null); // Continue even if image fails
          // Fallback timeout per image
          setTimeout(() => resolve(null), 5000);
        });
      })
    );
    
    // Additional wait to ensure rendering
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('[PDF] All images loaded, generating PDF...');
    
    const opt = {
      margin: [0.5, 0.5, 0.5, 0.5],
      filename: `${options.storeName}_catalog.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        letterRendering: true,
        imageTimeout: 0,
        backgroundColor: '#ffffff',
        width: 794,
        windowWidth: 794,
        onclone: (clonedDoc: Document) => {
          // Ensure floats are preserved in cloned document
          const cards = clonedDoc.querySelectorAll('.product-card');
          cards.forEach((card: Element) => {
            (card as HTMLElement).style.float = 'left';
            (card as HTMLElement).style.display = 'block';
          });
          
          // Force flexbox centering on footers for proper PDF rendering
          const footers = clonedDoc.querySelectorAll('.product-footer');
          footers.forEach((footer: Element) => {
            (footer as HTMLElement).style.display = 'flex';
            (footer as HTMLElement).style.alignItems = 'center';
            (footer as HTMLElement).style.justifyContent = 'center';
            (footer as HTMLElement).style.textAlign = 'center';
          });
          
          // Force text centering on price badges
          const prices = clonedDoc.querySelectorAll('.product-price');
          prices.forEach((price: Element) => {
            (price as HTMLElement).style.textAlign = 'center';
            (price as HTMLElement).style.display = 'block';
          });
        }
      },
      jsPDF: { 
        unit: 'cm', 
        format: 'a4', 
        orientation: 'portrait',
        compress: true
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    // Use the iframe's body for PDF generation
    const bodyElement = iframeDoc.body;

    // Generate PDF, save it, and get blob
    const worker = html2pdf().set(opt).from(bodyElement);
    
    // Download the PDF
    await worker.save();
    
    // Also get the blob for storage upload
    const pdfBlob = await worker.output('blob');

    console.log('[PDF] PDF generated successfully, size:', pdfBlob.size);

    return { pdfBlob, htmlContent };
  } finally {
    document.body.removeChild(iframe);
  }
};

// Generate WhatsApp Status image (9:16 aspect ratio)
export interface WhatsAppStatusOptions {
  product: CatalogProduct;
  storeId: string;
  storeName: string;
  storeLogo?: string;
  storeSlug: string;
  variantIndex?: number;
  primaryColor?: string;
  showQR?: boolean;
}

// Generate WhatsApp Status image (9:16 aspect ratio) - Ultra-Minimalist
// ONLY includes: Full-screen product image, Price overlay, QR code at bottom
// NO title, NO description - image speaks for itself
export const generateWhatsAppStatusImage = async (options: WhatsAppStatusOptions): Promise<HTMLCanvasElement> => {
  const { product, storeId, storeName, storeSlug, variantIndex = 0, primaryColor = '#8B5CF6', showQR = true } = options;
  
  // WhatsApp Status dimensions (9:16)
  const width = 1080;
  const height = 1920;
  
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  
  // Load and draw product image FULL SCREEN
  const variant = product.variants?.[variantIndex];
  const imageUrl = variant?.image || product.images[0] || '/placeholder.svg';
  
  try {
    const img = await loadImage(imageUrl);
    
    // Draw product image covering the entire canvas
    const scale = Math.max(width / img.width, height / img.height);
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;
    const offsetX = (width - scaledWidth) / 2;
    const offsetY = (height - scaledHeight) / 2;
    
    ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
  } catch (e) {
    // Draw solid background if image fails
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
  }
  
  // Create elegant gradient overlay at bottom for price/QR
  const overlayHeight = 480;
  const bottomGradient = ctx.createLinearGradient(0, height - overlayHeight, 0, height);
  bottomGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  bottomGradient.addColorStop(0.3, 'rgba(0, 0, 0, 0.4)');
  bottomGradient.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
  ctx.fillStyle = bottomGradient;
  ctx.fillRect(0, height - overlayHeight, width, overlayHeight);
  
  // Price - Large, prominent, bottom section
  const priceY = height - 280;
  ctx.font = 'bold 120px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 4;
  ctx.fillText(formatPrice(product.precio_venta), width / 2, priceY);
  
  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  
  // QR Code - positioned elegantly at bottom right
  if (showQR) {
    const productLink = getProductLink(product, storeSlug, variant?.id);
    const trackingUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-catalog-click?sid=${storeId}&pid=${product.id}&src=whatsapp_status&redirect=${encodeURIComponent(productLink)}`;
    
    try {
      const qrImg = await loadImage(await generateQRCode(trackingUrl, 180));
      const qrSize = 140;
      const qrX = width - qrSize - 40;
      const qrY = height - qrSize - 40;
      
      // White background for QR with rounded corners
      ctx.fillStyle = '#ffffff';
      roundedRect(ctx, qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 12);
      ctx.fill();
      
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
    } catch (e) {
      console.error('Error loading QR:', e);
    }
  }
  
  // Minimal store watermark at top (small, subtle)
  ctx.font = '600 28px Inter, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 10;
  ctx.fillText(storeName, 40, 60);
  
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  
  return canvas;
};

// Helper: Load image as promise
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

// Helper: Draw rounded rectangle
const roundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

// Download single WhatsApp status image
export const downloadWhatsAppStatusImage = async (options: WhatsAppStatusOptions): Promise<void> => {
  const canvas = await generateWhatsAppStatusImage(options);
  
  const link = document.createElement('a');
  link.download = `${options.product.sku}_whatsapp_status.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
};

// Generate multiple WhatsApp status images and download as ZIP
export const downloadWhatsAppStatusBulk = async (
  products: CatalogProduct[],
  storeInfo: { storeId: string; storeName: string; storeLogo?: string; storeSlug: string },
  onProgress?: (current: number, total: number) => void
): Promise<void> => {
  // Dynamic import of JSZip
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  
  const total = products.length;
  
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    onProgress?.(i + 1, total);
    
    const canvas = await generateWhatsAppStatusImage({
      product,
      ...storeInfo,
    });
    
    // Convert canvas to blob
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/png');
    });
    
    // Add to zip
    zip.file(`${product.sku.replace(/[^a-zA-Z0-9]/g, '_')}_status.png`, blob);
  }
  
  // Generate and download zip
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const link = document.createElement('a');
  link.download = `${storeInfo.storeName.replace(/\s+/g, '_')}_whatsapp_status.zip`;
  link.href = URL.createObjectURL(zipBlob);
  link.click();
  URL.revokeObjectURL(link.href);
};
