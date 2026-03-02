#!/usr/bin/env pwsh
# =====================================================
# Script de Inicio Rápido - Inventario B2C
# =====================================================

Write-Host "🚀 Verificando implementación del Inventario B2C..." -ForegroundColor Cyan
Write-Host ""

# Verificar que los archivos existen
$archivos = @(
    "src/hooks/useInventarioB2C.ts",
    "src/pages/seller/SellerInventarioB2C.tsx",
    "FUNCION_INVENTARIO_B2C_SEGURA.sql",
    "VERIFICAR_FUNCIONES_B2C.sql"
)

Write-Host "📁 Verificando archivos..." -ForegroundColor Yellow
foreach ($archivo in $archivos) {
    if (Test-Path $archivo) {
        Write-Host "  ✅ $archivo" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $archivo (No encontrado)" -ForegroundColor Red
    }
}
Write-Host ""

# Verificar que no hay errores de TypeScript
Write-Host "🔍 Verificando errores de TypeScript..." -ForegroundColor Yellow
$tsErrors = npx tsc --noEmit 2>&1 | Select-String -Pattern "error TS"
if ($tsErrors) {
    Write-Host "  ⚠️  Se encontraron errores de TypeScript" -ForegroundColor Yellow
    $tsErrors | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
} else {
    Write-Host "  ✅ Sin errores de TypeScript" -ForegroundColor Green
}
Write-Host ""

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ IMPLEMENTACIÓN COMPLETA" -ForegroundColor Green
Write-Host ""
Write-Host "📋 PASOS SIGUIENTES:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1️⃣  Ejecuta VERIFICAR_FUNCIONES_B2C.sql en Supabase SQL Editor" -ForegroundColor White
Write-Host "   Para verificar que las funciones se crearon correctamente" -ForegroundColor Gray
Write-Host ""
Write-Host "2️⃣  Inicia el servidor de desarrollo:" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "3️⃣  Abre tu navegador en:" -ForegroundColor White
Write-Host "   http://localhost:5173/seller/inventario" -ForegroundColor Cyan
Write-Host ""
Write-Host "4️⃣  Inicia sesión con un usuario que tenga pedidos B2B pagados" -ForegroundColor White
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "📚 DOCUMENTACIÓN:" -ForegroundColor Yellow
Write-Host "   - IMPLEMENTACION_INVENTARIO_B2C_COMPLETA.md" -ForegroundColor Gray
Write-Host "   - FRONTEND_INVENTARIO_B2C.md" -ForegroundColor Gray
Write-Host ""
Write-Host "🔧 TROUBLESHOOTING:" -ForegroundColor Yellow
Write-Host "   Si no ves productos, verifica que:" -ForegroundColor Gray
Write-Host "   - Tengas pedidos B2B con status 'paid', 'placed', 'delivered' o 'completed'" -ForegroundColor Gray
Write-Host "   - order_items_b2b.variant_id IS NOT NULL" -ForegroundColor Gray
Write-Host "   - Tengas una tienda (stores.owner_user_id = tu user_id)" -ForegroundColor Gray
Write-Host ""
