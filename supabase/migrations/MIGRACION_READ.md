# SIVER MARKET 509 - Complete Database Migration Package

## 📁 Files Included

| File | Description | Size |
|------|-------------|------|
| `DATABASE_SCHEMA_MIGRATION.sql` | Complete schema (100+ tables, RLS, indexes, functions) | ~200KB |
| `COMPLETE_SEED_DATA.sql` | Essential configuration data (logistics, categories, settings) | ~15KB |
| `PRODUCTS_DATA.sql` | Sample products with variants | ~12KB |
| `PRODUCTS_DATA.json` | Products in JSON format for imports | ~8KB |

---

## 🚀 Migration Steps

### Step 1: Create New Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Wait for project to be ready

### Step 2: Enable Required Extensions
Run in SQL Editor:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### Step 3: Run Schema Migration
1. Open SQL Editor in Supabase Dashboard
2. Copy and run: `DATABASE_SCHEMA_MIGRATION.sql`
3. Wait for completion (may take 1-2 minutes)

### Step 4: Run Seed Data
1. Run: `COMPLETE_SEED_DATA.sql`
2. This creates:
   - 10 Haiti departments + 25+ communes
   - Shipping routes (China → Miami → Haiti)
   - B2B margin ranges
   - 24 product categories
   - EAV attribute system

### Step 5: (Optional) Import Products
Run: `PRODUCTS_DATA.sql` for sample products

---

## 📊 Key Database Tables

### Core Commerce
| Table | Description |
|-------|-------------|
| `products` | B2B wholesale catalog |
| `product_variants` | Size/color variants with stock |
| `seller_catalog` | B2C retail inventory |
| `stores` | Seller storefronts |

### Logistics
| Table | Description |
|-------|-------------|
| `shipping_origins` | Source countries (e.g., China) |
| `transit_hubs` | Transit points (e.g., Miami) |
| `destination_countries` | Target markets |
| `shipping_routes` | Complete routes |
| `route_logistics_costs` | Per-segment costs |

### Geography (Haiti)
| Table | Description |
|-------|-------------|
| `departments` | 10 administrative regions |
| `communes` | Cities with delivery rates |

### Orders
| Table | Description |
|-------|-------------|
| `orders_b2b` | Wholesale orders |
| `orders_b2c` | Retail orders |
| `master_purchase_orders` | Consolidation system |

### Financial
| Table | Description |
|-------|-------------|
| `seller_wallets` | Seller balances |
| `b2b_margin_ranges` | Dynamic pricing tiers |

---

## 🔒 Security Features

- **Row Level Security (RLS)** enabled on all tables
- **User Roles**: `admin`, `seller`, `user`, `moderator`, `staff_pickup`
- **Helper Functions**:
  - `is_admin()` - Check admin status
  - `has_role(user_id, role)` - Check specific role
  - `is_seller()` - Check seller status

---

## ⚙️ Configuration Values

### B2B Margin Ranges (Protection Rule)
| Range | Margin |
|-------|--------|
| $0 - $10 | 300% |
| $10 - $50 | 30% |
| $50+ | 20% |

### Shipping Costs
| Route | Cost/kg |
|-------|---------|
| China → Miami | $7.00 |
| Miami → Haiti | $7.00 |
| **Total** | **$14.00/kg** |

### Delivery ETA
| Segment | Days |
|---------|------|
| China → Transit | 7-15 |
| Transit → Destination | 3-5 |
| **Total** | **10-20 days** |

---

## 🔄 Data Format Options

### SQL Format
- Use for direct Supabase SQL Editor import
- Includes ON CONFLICT clauses for safe re-runs

### JSON Format
- Use for programmatic imports
- Includes full product + variant structure

---

## 📝 Notes

1. **Vector Extension**: Required for AI embeddings (product similarity)
2. **Triggers**: Several triggers auto-create profiles, wallets, and stores
3. **Functions**: 50+ database functions for business logic
4. **Views**: Materialized views for performance

---

## 🆘 Troubleshooting

### "relation does not exist"
Run migrations in order: schema → seed → products

### "violates foreign key constraint"
Ensure seed data is inserted before products

### "permission denied"
Check RLS policies; use service role key for admin operations

---

## 📞 Support

For questions about this migration package, refer to:
- `ARCHITECTURE_B2B_B2C.md` - System architecture
- `B2B_COMPLETE_README.md` - Business logic
- `DOCUMENTATION_INDEX.md` - Full docs index
