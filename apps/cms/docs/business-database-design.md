# Business Database Design: Food Delivery Platform
## Enterprise-Grade Schema Architecture for Vendor, Merchant, Product & Category Management

---

## Executive Summary

This document presents a comprehensive database design for a food delivery platform similar to UberEats and FoodPanda, following enterprise-grade principles and industry best practices. The design addresses scalability, maintainability, and performance requirements while answering critical architectural questions about table relationships and normalization strategies.

**Key Design Decisions:**
- **Products as Standalone Tables**: ✅ Recommended for scalability and flexibility
- **Product Categories as Standalone Tables**: ✅ Recommended for enterprise-grade management
- **Three-Layer Architecture**: Base tables, specific tables, and association tables
- **Elimination of Data Duplication**: Single source of truth for all shared information

---

## Research Findings: Industry Best Practices

### UberEats & FoodPanda Architecture Insights

Based on comprehensive research of major food delivery platforms, the following patterns emerge:

**1. Three-Sided Marketplace Model**
- **Vendors/Restaurants**: Business entities with multiple locations
- **Merchants/Outlets**: Specific locations of vendor businesses
- **Products/Menu Items**: Individual food items with complex attributes
- **Categories**: Hierarchical organization of products

**2. Scalability Patterns**
- Separate tables for each entity type to handle millions of records
- Normalized data structure to prevent duplication and inconsistencies
- Strategic indexing for high-performance queries
- Materialized views for complex analytical operations

**3. Enterprise-Grade Features**
- Audit trails for all business-critical operations
- Flexible attribute systems for varying product requirements
- Geographic indexing for location-based queries
- Multi-tenant architecture support

### Enterprise Database Architecture Principles Applied

From the comprehensive analysis of `enterprise-database-architecture.md`, the following principles guide our design:

**1. Three-Layer Data Architecture**
- **Base Tables**: Universal information shared across entity types
- **Specific Tables**: Type-specific attributes and behaviors
- **Association Tables**: Complex relationships and many-to-many connections

**2. Single Source of Truth**
- Eliminate all data duplication across tables
- Consolidate shared information in authoritative locations
- Implement proper foreign key relationships

**3. Performance Optimization**
- Strategic indexing for common query patterns
- Materialized views for complex analytical queries
- Database functions for frequently used operations

---

## Schema Design Architecture

### 1. Vendor Table Schema

**Purpose**: Represents the business entity (e.g., Jollibee Corporation, McDonald's Philippines)

```sql
CREATE TABLE vendors (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Core business information
    business_name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255) NOT NULL,
    business_registration_number VARCHAR(100) UNIQUE NOT NULL,
    tax_identification_number VARCHAR(100) UNIQUE,
    
    -- Contact information
    primary_contact_email VARCHAR(255) NOT NULL,
    primary_contact_phone VARCHAR(50) NOT NULL,
    website_url VARCHAR(500),
    
    -- Business classification
    business_type VARCHAR(100) NOT NULL, -- 'restaurant', 'grocery', 'pharmacy', etc.
    cuisine_types TEXT[], -- Array of cuisine types for restaurants
    
    -- Operational status
    is_active BOOLEAN DEFAULT true,
    verification_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'verified', 'rejected'
    onboarding_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Business metrics
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    total_reviews INTEGER DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX idx_vendors_business_type ON vendors(business_type);
CREATE INDEX idx_vendors_verification_status ON vendors(verification_status);
CREATE INDEX idx_vendors_is_active ON vendors(is_active);
CREATE INDEX idx_vendors_cuisine_types ON vendors USING GIN(cuisine_types);
```

### 2. Merchant Table Schema

**Purpose**: Represents specific locations/outlets of vendor businesses (e.g., Jollibee Manila, Jollibee Quezon City)

```sql
CREATE TABLE merchants (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    
    -- Location identification
    outlet_name VARCHAR(255) NOT NULL,
    outlet_code VARCHAR(100) UNIQUE NOT NULL, -- Internal reference code
    
    -- Address information
    street_address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state_province VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'Philippines',
    
    -- Geographic coordinates for delivery radius
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    delivery_radius_km DECIMAL(5,2) DEFAULT 5.00,
    
    -- Contact information
    contact_phone VARCHAR(50),
    contact_email VARCHAR(255),
    manager_name VARCHAR(255),
    
    -- Operational information
    is_active BOOLEAN DEFAULT true,
    is_accepting_orders BOOLEAN DEFAULT true,
    opening_hours JSONB, -- Flexible schedule storage
    
    -- Delivery settings
    minimum_order_amount DECIMAL(10,2) DEFAULT 0.00,
    delivery_fee DECIMAL(10,2) DEFAULT 0.00,
    estimated_delivery_time_minutes INTEGER DEFAULT 30,
    
    -- Performance metrics
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    total_reviews INTEGER DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    average_preparation_time_minutes INTEGER DEFAULT 20,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX idx_merchants_vendor_id ON merchants(vendor_id);
CREATE INDEX idx_merchants_is_active ON merchants(is_active);
CREATE INDEX idx_merchants_is_accepting_orders ON merchants(is_accepting_orders);
CREATE INDEX idx_merchants_location ON merchants(latitude, longitude);
CREATE INDEX idx_merchants_city ON merchants(city);

-- Spatial index for geographic queries
CREATE INDEX idx_merchants_geolocation ON merchants USING GIST(
    ST_Point(longitude, latitude)
);
```

### 3. Product Categories Table Schema

**Purpose**: Hierarchical organization of products with enterprise-grade flexibility

```sql
CREATE TABLE product_categories (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Category information
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    
    -- Hierarchical structure
    parent_category_id UUID REFERENCES product_categories(id),
    category_level INTEGER DEFAULT 1,
    category_path TEXT, -- Materialized path for efficient queries
    
    -- Display information
    display_order INTEGER DEFAULT 0,
    icon_url VARCHAR(500),
    banner_image_url VARCHAR(500),
    color_theme VARCHAR(7), -- Hex color code
    
    -- Operational status
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    
    -- SEO and marketing
    meta_title VARCHAR(255),
    meta_description TEXT,
    keywords TEXT[],
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX idx_product_categories_parent ON product_categories(parent_category_id);
CREATE INDEX idx_product_categories_level ON product_categories(category_level);
CREATE INDEX idx_product_categories_active ON product_categories(is_active);
CREATE INDEX idx_product_categories_featured ON product_categories(is_featured);
CREATE INDEX idx_product_categories_path ON product_categories(category_path);
```

### 4. Products Table Schema

**Purpose**: Individual food items and products with comprehensive attributes

```sql
CREATE TABLE products (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    primary_category_id UUID NOT NULL REFERENCES product_categories(id),
    
    -- Product information
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    short_description VARCHAR(500),
    
    -- Pricing information
    base_price DECIMAL(10,2) NOT NULL,
    discounted_price DECIMAL(10,2),
    cost_price DECIMAL(10,2), -- For profit margin calculations
    
    -- Product attributes
    sku VARCHAR(100) UNIQUE,
    barcode VARCHAR(100),
    weight_grams INTEGER,
    calories INTEGER,
    preparation_time_minutes INTEGER DEFAULT 15,
    
    -- Availability and inventory
    is_available BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    stock_quantity INTEGER,
    low_stock_threshold INTEGER DEFAULT 5,
    
    -- Dietary and allergen information
    is_vegetarian BOOLEAN DEFAULT false,
    is_vegan BOOLEAN DEFAULT false,
    is_gluten_free BOOLEAN DEFAULT false,
    allergens TEXT[], -- Array of allergen information
    ingredients TEXT[],
    
    -- Media and presentation
    primary_image_url VARCHAR(500),
    image_urls TEXT[], -- Array of additional images
    display_order INTEGER DEFAULT 0,
    
    -- Performance metrics
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    total_reviews INTEGER DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    
    -- SEO and marketing
    meta_title VARCHAR(255),
    meta_description TEXT,
    keywords TEXT[],
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX idx_products_merchant_id ON products(merchant_id);
CREATE INDEX idx_products_primary_category ON products(primary_category_id);
CREATE INDEX idx_products_is_available ON products(is_available);
CREATE INDEX idx_products_is_featured ON products(is_featured);
CREATE INDEX idx_products_price_range ON products(base_price);
CREATE INDEX idx_products_rating ON products(average_rating);
CREATE INDEX idx_products_dietary ON products(is_vegetarian, is_vegan, is_gluten_free);
CREATE INDEX idx_products_allergens ON products USING GIN(allergens);
CREATE INDEX idx_products_ingredients ON products USING GIN(ingredients);
```

### 5. Association Tables for Complex Relationships

#### Product-Category Associations (Many-to-Many)
```sql
CREATE TABLE product_category_associations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
    association_type VARCHAR(50) DEFAULT 'secondary', -- 'primary', 'secondary', 'promotional'
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(product_id, category_id, association_type)
);
```

#### Product Variants and Options
```sql
CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_name VARCHAR(255) NOT NULL, -- 'Size', 'Spice Level', 'Add-ons'
    variant_type VARCHAR(100) NOT NULL, -- 'single_select', 'multi_select', 'text_input'
    is_required BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_variant_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    option_name VARCHAR(255) NOT NULL,
    price_adjustment DECIMAL(10,2) DEFAULT 0.00,
    is_available BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## Answering Critical Design Questions

### Question 1: Should products be a standalone table?

**Answer: YES - Absolutely Recommended**

**Rationale:**
1. **Scalability**: Standalone products table can handle millions of menu items efficiently
2. **Flexibility**: Different merchants can have vastly different product attributes
3. **Performance**: Optimized indexing and querying capabilities
4. **Maintainability**: Clear separation of concerns and easier debugging
5. **Business Logic**: Products have complex relationships with categories, variants, and orders

**Alternative Approach (NOT Recommended):**
Embedding products within merchants table would create:
- Massive JSON/JSONB fields that are difficult to query efficiently
- Performance degradation as product catalogs grow
- Complex application logic for product management
- Difficulty in implementing product-specific features like reviews, recommendations

### Question 2: Should product categories be a standalone table?

**Answer: YES - Essential for Enterprise Architecture**

**Rationale:**
1. **Hierarchical Management**: Categories often have parent-child relationships (Food > Asian > Chinese)
2. **Cross-Merchant Categories**: Multiple merchants share the same categories
3. **Marketing Flexibility**: Categories need their own metadata, images, and SEO attributes
4. **Performance Optimization**: Separate indexing and caching strategies for category browsing
5. **Administrative Efficiency**: Centralized category management across the platform

**Enterprise Benefits:**
- **Consistency**: Standardized categorization across all merchants
- **Analytics**: Category-level performance tracking and insights
- **User Experience**: Efficient category browsing and filtering
- **SEO Optimization**: Category-specific landing pages and metadata

---

## Advanced Architecture Patterns

### 1. Materialized Views for Performance

```sql
-- Merchant performance summary
CREATE MATERIALIZED VIEW merchant_performance_summary AS
SELECT 
    m.id,
    m.outlet_name,
    v.business_name,
    COUNT(p.id) as total_products,
    AVG(p.average_rating) as avg_product_rating,
    SUM(p.total_orders) as total_product_orders,
    m.average_rating as merchant_rating,
    m.total_orders as merchant_orders
FROM merchants m
JOIN vendors v ON m.vendor_id = v.id
LEFT JOIN products p ON m.id = p.merchant_id
WHERE m.is_active = true
GROUP BY m.id, m.outlet_name, v.business_name, m.average_rating, m.total_orders;

-- Category popularity analysis
CREATE MATERIALIZED VIEW category_popularity_summary AS
SELECT 
    pc.id,
    pc.name,
    pc.category_level,
    COUNT(p.id) as total_products,
    AVG(p.average_rating) as avg_rating,
    SUM(p.total_orders) as total_orders,
    COUNT(DISTINCT p.merchant_id) as merchant_count
FROM product_categories pc
LEFT JOIN products p ON pc.id = p.primary_category_id
WHERE pc.is_active = true
GROUP BY pc.id, pc.name, pc.category_level;
```

### 2. Database Functions for Complex Operations

```sql
-- Function to calculate delivery availability
CREATE OR REPLACE FUNCTION check_delivery_availability(
    customer_lat DECIMAL(10,8),
    customer_lng DECIMAL(11,8),
    merchant_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    merchant_lat DECIMAL(10,8);
    merchant_lng DECIMAL(11,8);
    delivery_radius DECIMAL(5,2);
    distance_km DECIMAL(10,2);
BEGIN
    SELECT latitude, longitude, delivery_radius_km
    INTO merchant_lat, merchant_lng, delivery_radius
    FROM merchants
    WHERE id = merchant_id AND is_active = true AND is_accepting_orders = true;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Calculate distance using Haversine formula
    distance_km := (
        6371 * acos(
            cos(radians(customer_lat)) * 
            cos(radians(merchant_lat)) * 
            cos(radians(merchant_lng) - radians(customer_lng)) + 
            sin(radians(customer_lat)) * 
            sin(radians(merchant_lat))
        )
    );
    
    RETURN distance_km <= delivery_radius;
END;
$$ LANGUAGE plpgsql;
```

### 3. Audit Trail Implementation

```sql
-- Audit table for tracking changes
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    operation VARCHAR(20) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    old_values JSONB,
    new_values JSONB,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);

-- Trigger function for automatic audit logging
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (table_name, record_id, operation, old_values, changed_by)
        VALUES (TG_TABLE_NAME, OLD.id, TG_OP, row_to_json(OLD), OLD.updated_by);
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (table_name, record_id, operation, old_values, new_values, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(OLD), row_to_json(NEW), NEW.updated_by);
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (table_name, record_id, operation, new_values, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(NEW), NEW.created_by);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

---

## Performance Optimization Strategies

### 1. Strategic Indexing Plan

**High-Priority Indexes:**
- Geographic queries: Spatial indexes on merchant locations
- Category browsing: Composite indexes on category hierarchy
- Product search: Full-text search indexes on product names and descriptions
- Performance metrics: Indexes on rating and order counts

**Query-Specific Optimizations:**
- Merchant discovery by location and cuisine type
- Product filtering by price range, dietary restrictions, and availability
- Category navigation with hierarchical queries
- Order history and analytics queries

### 2. Caching Strategy

**Application-Level Caching:**
- Merchant information and operating hours
- Product catalogs with pricing and availability
- Category hierarchies and navigation structures
- User preferences and order history

**Database-Level Caching:**
- Materialized views for complex analytical queries
- Cached results for geographic proximity calculations
- Pre-computed aggregations for dashboard metrics

### 3. Scalability Considerations

**Horizontal Scaling:**
- Partition large tables by geographic regions
- Separate read replicas for analytics and reporting
- Implement connection pooling for high-concurrency scenarios

**Vertical Scaling:**
- Optimize query performance through proper indexing
- Implement database functions for complex operations
- Use materialized views for expensive analytical queries

---

## Implementation Roadmap

### Phase 1: Core Schema Implementation (Week 1-2)
1. Create base tables: vendors, merchants, product_categories, products
2. Implement primary indexes and constraints
3. Set up basic audit logging
4. Create initial data migration scripts

### Phase 2: Advanced Features (Week 3-4)
1. Implement product variants and options
2. Create association tables for complex relationships
3. Set up materialized views for performance
4. Implement geographic search capabilities

### Phase 3: Optimization and Analytics (Week 5-6)
1. Create comprehensive indexing strategy
2. Implement database functions for complex operations
3. Set up monitoring and performance tracking
4. Create analytics and reporting views

### Phase 4: Production Readiness (Week 7-8)
1. Comprehensive testing of all database operations
2. Performance benchmarking and optimization
3. Security audit and access control implementation
4. Documentation and team training

---

## Security and Compliance Considerations

### Data Protection
- Encrypt sensitive business information (tax IDs, financial data)
- Implement row-level security for multi-tenant access
- Regular security audits and vulnerability assessments
- Compliance with data protection regulations (GDPR, local privacy laws)

### Access Control
- Role-based access control for different user types
- API key authentication for external integrations
- Audit logging for all data modifications
- Secure backup and recovery procedures

### Business Continuity
- Automated backup strategies with point-in-time recovery
- Disaster recovery procedures and testing
- High availability configuration for production systems
- Monitoring and alerting for system health

---

## Conclusion

This enterprise-grade database design provides a scalable, maintainable, and high-performance foundation for a food delivery platform. By following industry best practices and proven architectural patterns, the design supports:

- **Millions of products** across thousands of merchants
- **Complex business relationships** with proper normalization
- **High-performance queries** through strategic indexing
- **Future scalability** without architectural rewrites
- **Enterprise-grade features** including audit trails and analytics

The standalone table approach for both products and categories ensures maximum flexibility, performance, and maintainability while following the three-layer architecture principles that power the world's largest technology platforms.

**Key Success Factors:**
1. Proper normalization eliminates data duplication
2. Strategic indexing ensures fast query performance
3. Flexible schema design accommodates business evolution
4. Comprehensive audit trails support compliance and debugging
5. Materialized views enable complex analytics without performance impact

This design positions the platform for sustainable growth and enterprise-scale operations while maintaining development efficiency and system reliability.