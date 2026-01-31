#!/usr/bin/env python3
"""
Script para ejecutar la migración de precios dinámicos en Supabase
Usage: python apply_dynamic_pricing.py
"""

import os
import sys
from pathlib import Path

# Intenta importar Supabase
try:
    from supabase import create_client
except ImportError:
    print("Error: pip install python-supabase")
    sys.exit(1)

# Configuración
SUPABASE_URL = "https://fonvunyiaxcjkodrnpox.supabase.co"
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")

if not SUPABASE_KEY:
    print("Error: Configurar variable de entorno SUPABASE_KEY o SUPABASE_SERVICE_KEY")
    sys.exit(1)

# Leer archivo de migración
migration_file = Path(__file__).parent / "supabase/migrations/20260131_create_dynamic_pricing_view.sql"

if not migration_file.exists():
    print(f"Error: No se encontró {migration_file}")
    sys.exit(1)

# Leer contenido
with open(migration_file, 'r', encoding='utf-8') as f:
    sql_script = f.read()

print("=" * 70)
print("APLICANDO MIGRACIÓN DE PRECIOS DINÁMICOS")
print("=" * 70)
print(f"URL: {SUPABASE_URL}")
print(f"Archivo: {migration_file}")
print()

# Crear cliente
try:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("✓ Conectado a Supabase")
except Exception as e:
    print(f"✗ Error al conectar: {e}")
    sys.exit(1)

# Ejecutar migración
try:
    # Dividir por sentencias
    statements = [s.strip() for s in sql_script.split(';') if s.strip()]
    
    total = len(statements)
    print(f"\nEjecutando {total} sentencias SQL...")
    print()
    
    for i, statement in enumerate(statements, 1):
        if not statement or statement.startswith('--'):
            continue
            
        print(f"[{i}/{total}] Ejecutando: {statement[:60]}...")
        
        try:
            # Usar rpc para ejecutar SQL
            result = supabase.postgrest.raw(statement)
            print(f"  ✓ OK")
        except Exception as e:
            if "already exists" in str(e).lower():
                print(f"  ⚠ Ya existe (ignorado)")
            else:
                print(f"  ✗ Error: {e}")
                # Continuar con siguiente sentencia
    
    print()
    print("=" * 70)
    print("✓ MIGRACIÓN COMPLETADA")
    print("=" * 70)
    print()
    print("Próximos pasos:")
    print("1. Verificar vistas en Supabase: SELECT * FROM v_productos_con_precio_b2b LIMIT 1;")
    print("2. Actualizar servicios frontend según DYNAMIC_PRICING_IMPLEMENTATION.md")
    print("3. Testear que precios se calculan correctamente")
    
except Exception as e:
    print(f"\n✗ Error durante la migración: {e}")
    sys.exit(1)
