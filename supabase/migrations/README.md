# SIVER MARKET 509 - Database Export Guide

## Files Generated

| File | Description |
|------|-------------|
| `DATABASE_SCHEMA_MIGRATION.sql` | Complete schema with 100+ tables, RLS policies, indexes, and functions |
| `SEED_DATA.sql` | Essential seed data (categories, logistics, settings) |

## How to Apply to Another Supabase Project

### Step 1: Run Schema Migration
```bash
# In Supabase SQL Editor, run:
DATABASE_SCHEMA_MIGRATION.sql
```

### Step 2: Run Seed Data
```bash
# After schema is created, run:
SEED_DATA.sql
```

## Key Tables Summary

### Core Commerce
- `products` - B2B catalog (wholesale)
- `product_variants` - Size/color variants
- `seller_catalog` - B2C inventory (retail)
- `stores` - Seller storefronts

### Logistics
- `shipping_routes` + `route_logistics_costs` - Multi-segment pricing
- `departments` + `communes` - Haiti geographic divisions
- `markets` + `market_payment_methods` - Regional configuration

### Orders
- `orders_b2b` / `order_items_b2b` - Wholesale orders
- `orders_b2c` / `order_items_b2c` - Retail orders
- `master_purchase_orders` - Consolidation system

### Financial
- `seller_wallets` + `wallet_transactions` - Escrow system
- `b2b_margin_ranges` - Dynamic B2B pricing
- `commission_overrides` - Seller commissions

## Important Notes

1. **Vector Extension**: Products table uses `vector(384)` for AI embeddings - ensure pgvector is enabled
2. **RLS Policies**: All tables have Row Level Security enabled
3. **User Roles**: Uses `app_role` enum with `admin`, `seller`, `user` roles
