import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
    // ============================================
    // PRODUCT MANAGEMENT SCHEMA
    // Integrates with existing vendors and merchants tables
    // ============================================

    // 1. Products (Master Product Catalog)
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            
            -- Ownership tracking (FIX: Use dedicated FKs for data integrity)
            created_by_vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
            created_by_merchant_id INTEGER REFERENCES merchants(id) ON DELETE SET NULL,
            
            -- Constraint to enforce exactly one owner
            CONSTRAINT chk_one_owner_must_exist CHECK (
                (created_by_vendor_id IS NOT NULL AND created_by_merchant_id IS NULL) OR
                (created_by_vendor_id IS NULL AND created_by_merchant_id IS NOT NULL)
            ),
            
            -- Product Type (simple, variable, or group)
            product_type VARCHAR(20) NOT NULL DEFAULT 'simple' CHECK (product_type IN ('simple', 'variable', 'grouped')),
            parent_product_id INTEGER REFERENCES products(id) ON DELETE CASCADE, -- for variations, points to parent variable product
            
            -- Basic Info
            name VARCHAR(255) NOT NULL,
            description TEXT,
            short_description VARCHAR(500),
            category_id INTEGER REFERENCES prod_categories(id) ON DELETE SET NULL,
            
            -- SKU (unique to prevent duplicates)
            sku VARCHAR(100) UNIQUE,
            
            -- Pricing (for simple products and variations)
            base_price NUMERIC(10, 2) NOT NULL, -- every product must have a base price
            compare_at_price NUMERIC(10, 2), -- original price for showing discounts
            
            -- Media (using your existing media table pattern)
            image_ids JSONB, -- [1, 2, 3] array of media IDs
            media_primary_image_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
            
            -- Status
            is_active BOOLEAN DEFAULT TRUE,
            
            -- Metadata
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
    `);

    // Create indexes for products table
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_products_created_by_vendor ON products(created_by_vendor_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_products_created_by_merchant ON products(created_by_merchant_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_products_primary_image ON products(media_primary_image_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_products_parent ON products(parent_product_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_products_product_type ON products(product_type);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);`);

    // 2. Product Attributes (for variable products - e.g., Size, Color, Flavor)
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS prod_attributes (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL, -- "Size", "Color", "Flavor", etc.
            slug VARCHAR(100) NOT NULL,
            type VARCHAR(20) NOT NULL DEFAULT 'select' CHECK (type IN ('select', 'color', 'button', 'radio')),
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            CONSTRAINT prod_attributes_slug_unique UNIQUE(slug)
        );
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_prod_attributes_slug ON prod_attributes(slug);`);

    // 3. Product Attribute Terms (values for attributes - e.g., "Small", "Medium", "Large")
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS prod_attribute_terms (
            id SERIAL PRIMARY KEY,
            attribute_id INTEGER NOT NULL REFERENCES prod_attributes(id) ON DELETE CASCADE,
            name VARCHAR(100) NOT NULL, -- "Small", "Red", "Vanilla"
            slug VARCHAR(100) NOT NULL,
            value VARCHAR(100), -- for color type, stores hex code
            sort_order INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            CONSTRAINT prod_attribute_terms_unique UNIQUE(attribute_id, slug)
        );
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_prod_attribute_terms_attribute ON prod_attribute_terms(attribute_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_prod_attribute_terms_slug ON prod_attribute_terms(slug);`);

    // 4. Product Variations (links variable products to their attributes)
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS prod_variations (
            id SERIAL PRIMARY KEY,
            product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, -- the variable product
            attribute_id INTEGER NOT NULL REFERENCES prod_attributes(id) ON DELETE CASCADE,
            is_used_for_variations BOOLEAN DEFAULT TRUE, -- whether this attribute is used to create variations
            is_visible BOOLEAN DEFAULT TRUE, -- whether shown on product page
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            CONSTRAINT prod_variations_unique UNIQUE(product_id, attribute_id)
        );
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_prod_variations_product ON prod_variations(product_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_prod_variations_attribute ON prod_variations(attribute_id);`);

    // 5. Product Variation Values (specific attribute values for each variation)
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS prod_variation_values (
            id SERIAL PRIMARY KEY,
            variation_product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, -- the variation (child product)
            attribute_id INTEGER NOT NULL REFERENCES prod_attributes(id) ON DELETE CASCADE,
            term_id INTEGER NOT NULL REFERENCES prod_attribute_terms(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            CONSTRAINT prod_variation_values_unique UNIQUE(variation_product_id, attribute_id)
        );
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_prod_variation_values_variation ON prod_variation_values(variation_product_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_prod_variation_values_attribute ON prod_variation_values(attribute_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_prod_variation_values_term ON prod_variation_values(term_id);`);

    // 6. Grouped Products (for product bundles)
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS prod_grouped_items (
            id SERIAL PRIMARY KEY,
            parent_product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, -- the grouped product
            child_product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, -- individual product in the group
            default_quantity INTEGER DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            CONSTRAINT prod_grouped_items_unique UNIQUE(parent_product_id, child_product_id)
        );
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_prod_grouped_items_parent ON prod_grouped_items(parent_product_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_prod_grouped_items_child ON prod_grouped_items(child_product_id);`);

    // 7. Vendor Products (Products owned/managed by vendors)
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS vendor_products (
            id SERIAL PRIMARY KEY,
            vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
            product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            
            -- Cascade Settings
            auto_assign_to_new_merchants BOOLEAN DEFAULT FALSE,
            
            -- Status
            is_active BOOLEAN DEFAULT TRUE,
            
            -- Metadata
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            
            CONSTRAINT vendor_products_unique UNIQUE(vendor_id, product_id)
        );
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_vendor_products_vendor ON vendor_products(vendor_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_vendor_products_product ON vendor_products(product_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_vendor_products_created_at ON vendor_products(created_at);`);

    // 8. Merchant Products (Which merchants sell which products)
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS merchant_products (
            id SERIAL PRIMARY KEY,
            merchant_id INTEGER NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
            product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            
            -- Assignment tracking
            added_by VARCHAR(20) NOT NULL CHECK (added_by IN ('vendor', 'merchant')),
            
            -- Overrides (null = use product defaults)
            price_override NUMERIC(10, 2),
            
            -- Availability
            is_active BOOLEAN DEFAULT TRUE,
            is_available BOOLEAN DEFAULT TRUE, -- quick toggle on/off
            
            -- Metadata
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            
            CONSTRAINT merchant_products_unique UNIQUE(merchant_id, product_id)
        );
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_merchant_products_merchant ON merchant_products(merchant_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_merchant_products_product ON merchant_products(product_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_merchant_products_availability ON merchant_products(is_active, is_available);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_merchant_products_created_at ON merchant_products(created_at);`);

    // 9. Product Modifiers/Add-ons Groups (e.g., "Size", "Extras")
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS modifier_groups (
            id SERIAL PRIMARY KEY,
            product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            selection_type VARCHAR(20) NOT NULL CHECK (selection_type IN ('single', 'multiple')),
            is_required BOOLEAN DEFAULT FALSE,
            min_selections INTEGER DEFAULT 0,
            max_selections INTEGER, -- null = unlimited
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_modifier_groups_product ON modifier_groups(product_id);`);

    // 10. Product Modifiers/Add-ons Options
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS modifier_options (
            id SERIAL PRIMARY KEY,
            modifier_group_id INTEGER NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            price_adjustment NUMERIC(10, 2) DEFAULT 0.00,
            is_default BOOLEAN DEFAULT FALSE,
            is_available BOOLEAN DEFAULT TRUE,
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_modifier_options_group ON modifier_options(modifier_group_id);`);

    // 11. Product Tags (for categorization, filtering, and search)
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS prod_tags (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            slug VARCHAR(100) NOT NULL,
            description TEXT,
            color VARCHAR(7), -- hex color code for UI display (e.g., #FF5733)
            
            -- Tag Type/Category
            tag_type VARCHAR(50) DEFAULT 'general' CHECK (tag_type IN ('general', 'dietary', 'cuisine', 'promotion', 'feature', 'allergen', 'spice_level', 'temperature', 'size_category')),
            
            -- Hierarchy support (for nested tags)
            parent_tag_id INTEGER REFERENCES prod_tags(id) ON DELETE SET NULL,
            
            -- Usage tracking
            usage_count INTEGER DEFAULT 0, -- auto-updated via triggers
            
            -- Status
            is_active BOOLEAN DEFAULT TRUE,
            is_featured BOOLEAN DEFAULT FALSE, -- for highlighting important tags
            
            -- Metadata
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            
            CONSTRAINT prod_tags_slug_unique UNIQUE(slug)
        );
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_prod_tags_slug ON prod_tags(slug);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_prod_tags_tag_type ON prod_tags(tag_type);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_prod_tags_parent ON prod_tags(parent_tag_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_prod_tags_is_active ON prod_tags(is_active);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_prod_tags_is_featured ON prod_tags(is_featured);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_prod_tags_usage_count ON prod_tags(usage_count DESC);`);

    // 12. Product Tags Junction Table (Many-to-Many relationship)
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS prod_tags_junction (
            id SERIAL PRIMARY KEY,
            product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            tag_id INTEGER NOT NULL REFERENCES prod_tags(id) ON DELETE CASCADE,
            
            -- Assignment tracking
            added_by_type VARCHAR(20) NOT NULL CHECK (added_by_type IN ('vendor', 'merchant', 'system')),
            added_by_vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
            added_by_merchant_id INTEGER REFERENCES merchants(id) ON DELETE SET NULL,
            
            -- Constraint to ensure proper assignment tracking
            CONSTRAINT chk_tag_assignment_tracking CHECK (
                (added_by_type = 'vendor' AND added_by_vendor_id IS NOT NULL AND added_by_merchant_id IS NULL) OR
                (added_by_type = 'merchant' AND added_by_merchant_id IS NOT NULL AND added_by_vendor_id IS NULL) OR
                (added_by_type = 'system' AND added_by_vendor_id IS NULL AND added_by_merchant_id IS NULL)
            ),
            
            -- Priority/Weight for tag importance (higher = more important)
            priority INTEGER DEFAULT 0,
            
            -- Status
            is_active BOOLEAN DEFAULT TRUE,
            
            -- Metadata
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            
            CONSTRAINT prod_tags_junction_unique UNIQUE(product_id, tag_id)
        );
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_prod_tags_junction_product ON prod_tags_junction(product_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_prod_tags_junction_tag ON prod_tags_junction(tag_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_prod_tags_junction_added_by_vendor ON prod_tags_junction(added_by_vendor_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_prod_tags_junction_added_by_merchant ON prod_tags_junction(added_by_merchant_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_prod_tags_junction_priority ON prod_tags_junction(priority DESC);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_prod_tags_junction_is_active ON prod_tags_junction(is_active);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_prod_tags_junction_created_at ON prod_tags_junction(created_at);`);

    // 13. Tag Groups (for organizing related tags)
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS tag_groups (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            slug VARCHAR(100) NOT NULL,
            description TEXT,
            color VARCHAR(7), -- hex color for group display
            icon VARCHAR(50), -- icon class or name
            
            -- Display settings
            is_filterable BOOLEAN DEFAULT TRUE, -- show in filter UI
            is_searchable BOOLEAN DEFAULT TRUE, -- include in search
            display_order INTEGER DEFAULT 0,
            
            -- Status
            is_active BOOLEAN DEFAULT TRUE,
            
            -- Metadata
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            
            CONSTRAINT tag_groups_slug_unique UNIQUE(slug)
        );
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_tag_groups_slug ON tag_groups(slug);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_tag_groups_is_active ON tag_groups(is_active);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_tag_groups_display_order ON tag_groups(display_order);`);

    // 14. Tag Group Memberships (Many-to-Many: Tags can belong to multiple groups)
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS tag_group_memberships (
            id SERIAL PRIMARY KEY,
            tag_group_id INTEGER NOT NULL REFERENCES tag_groups(id) ON DELETE CASCADE,
            tag_id INTEGER NOT NULL REFERENCES prod_tags(id) ON DELETE CASCADE,
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            
            CONSTRAINT tag_group_memberships_unique UNIQUE(tag_group_id, tag_id)
        );
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_tag_group_memberships_group ON tag_group_memberships(tag_group_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_tag_group_memberships_tag ON tag_group_memberships(tag_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_tag_group_memberships_sort ON tag_group_memberships(sort_order);`);

    // ============================================
    // TRIGGERS (matching your existing pattern)
    // ============================================

    // Auto-update timestamps (if not already exists in your db)
    await db.execute(sql`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    `);

    await db.execute(sql`
        DROP TRIGGER IF EXISTS update_products_updated_at ON products;
        CREATE TRIGGER update_products_updated_at 
            BEFORE UPDATE ON products 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await db.execute(sql`
        DROP TRIGGER IF EXISTS update_vendor_products_updated_at ON vendor_products;
        CREATE TRIGGER update_vendor_products_updated_at 
            BEFORE UPDATE ON vendor_products 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await db.execute(sql`
        DROP TRIGGER IF EXISTS update_merchant_products_updated_at ON merchant_products;
        CREATE TRIGGER update_merchant_products_updated_at 
            BEFORE UPDATE ON merchant_products 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await db.execute(sql`
        DROP TRIGGER IF EXISTS update_prod_tags_updated_at ON prod_tags;
        CREATE TRIGGER update_prod_tags_updated_at 
            BEFORE UPDATE ON prod_tags 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await db.execute(sql`
        DROP TRIGGER IF EXISTS update_tag_groups_updated_at ON tag_groups;
        CREATE TRIGGER update_tag_groups_updated_at 
            BEFORE UPDATE ON tag_groups 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    // Tag Usage Count Trigger (auto-update usage_count in prod_tags)
    await db.execute(sql`
        CREATE OR REPLACE FUNCTION update_tag_usage_count()
        RETURNS TRIGGER AS $$
        BEGIN
            IF TG_OP = 'INSERT' THEN
                UPDATE prod_tags 
                SET usage_count = usage_count + 1 
                WHERE id = NEW.tag_id;
                RETURN NEW;
            ELSIF TG_OP = 'DELETE' THEN
                UPDATE prod_tags 
                SET usage_count = GREATEST(usage_count - 1, 0) 
                WHERE id = OLD.tag_id;
                RETURN OLD;
            END IF;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
    `);

    await db.execute(sql`
        DROP TRIGGER IF EXISTS update_tag_usage_on_insert ON prod_tags_junction;
        CREATE TRIGGER update_tag_usage_on_insert
            AFTER INSERT ON prod_tags_junction
            FOR EACH ROW EXECUTE FUNCTION update_tag_usage_count();
    `);

    await db.execute(sql`
        DROP TRIGGER IF EXISTS update_tag_usage_on_delete ON prod_tags_junction;
        CREATE TRIGGER update_tag_usage_on_delete
            AFTER DELETE ON prod_tags_junction
            FOR EACH ROW EXECUTE FUNCTION update_tag_usage_count();
    `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
    // Drop all tables in reverse order to handle foreign key constraints
    await db.execute(sql`DROP TABLE IF EXISTS tag_group_memberships CASCADE;`);
    await db.execute(sql`DROP TABLE IF EXISTS tag_groups CASCADE;`);
    await db.execute(sql`DROP TABLE IF EXISTS prod_tags_junction CASCADE;`);
    await db.execute(sql`DROP TABLE IF EXISTS prod_tags CASCADE;`);
    await db.execute(sql`DROP TABLE IF EXISTS modifier_options CASCADE;`);
    await db.execute(sql`DROP TABLE IF EXISTS modifier_groups CASCADE;`);
    await db.execute(sql`DROP TABLE IF EXISTS merchant_products CASCADE;`);
    await db.execute(sql`DROP TABLE IF EXISTS vendor_products CASCADE;`);
    await db.execute(sql`DROP TABLE IF EXISTS prod_grouped_items CASCADE;`);
    await db.execute(sql`DROP TABLE IF EXISTS prod_variation_values CASCADE;`);
    await db.execute(sql`DROP TABLE IF EXISTS prod_variations CASCADE;`);
    await db.execute(sql`DROP TABLE IF EXISTS prod_attribute_terms CASCADE;`);
    await db.execute(sql`DROP TABLE IF EXISTS prod_attributes CASCADE;`);
    await db.execute(sql`DROP TABLE IF EXISTS products CASCADE;`);
    
    // Drop functions
    await db.execute(sql`DROP FUNCTION IF EXISTS update_tag_usage_count() CASCADE;`);
    await db.execute(sql`DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;`);
}
