import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Helper: create a Postgres enum type only if it doesn't already exist
  const createEnumIfMissing = async (name: string, values: string[]) => {
    await db.execute(sql.raw(`
      DO $$ BEGIN
        CREATE TYPE "public"."${name}" AS ENUM('${values.join("','")}');
      EXCEPTION WHEN duplicate_object THEN
        -- already exists
      END $$;
    `))
  }

  // ─── Enums ──────────────────────────────────────────────────────────────────
  await createEnumIfMissing('enum_orders_delivery_status', ['none', 'pending', 'assigning_driver', 'driver_assigned', 'picked_up', 'completed', 'canceled', 'expired'])
  await createEnumIfMissing('enum_delivery_bookings_status', ['pending', 'assigning_driver', 'driver_assigned', 'picked_up', 'completed', 'canceled', 'rejected', 'expired'])
  await createEnumIfMissing('enum_prod_variations_modifier_behavior_mode', ['inherit_product', 'variation_specific', 'hybrid'])
  await createEnumIfMissing('enum_variation_modifier_groups_selection_type', ['single', 'multiple'])
  await createEnumIfMissing('enum_variation_modifier_group_overrides_mode', ['inherit', 'hide', 'override'])
  await createEnumIfMissing('enum_variation_modifier_group_overrides_selection_type_override', ['single', 'multiple'])
  await createEnumIfMissing('enum_variation_modifier_group_overrides_required_behavior', ['inherit', 'required', 'optional'])
  await createEnumIfMissing('enum_variation_modifier_option_overrides_mode', ['inherit', 'hide', 'override'])
  await createEnumIfMissing('enum_variation_modifier_option_overrides_default_behavior', ['inherit', 'default', 'not_default'])
  await createEnumIfMissing('enum_variation_modifier_option_overrides_availability_behavior', ['inherit', 'available', 'unavailable'])
  await createEnumIfMissing('enum_merchant_modifier_group_override_mode', ['inherit', 'hide', 'override'])
  await createEnumIfMissing('enum_merchant_modifier_selection_type', ['single', 'multiple'])
  await createEnumIfMissing('enum_merchant_modifier_group_required_behavior', ['inherit', 'required', 'optional'])
  await createEnumIfMissing('enum_merchant_modifier_option_override_mode', ['inherit', 'hide', 'override'])
  await createEnumIfMissing('enum_merchant_modifier_option_default_behavior', ['inherit', 'default', 'not_default'])
  await createEnumIfMissing('enum_merchant_modifier_option_availability_behavior', ['inherit', 'available', 'unavailable'])
  await createEnumIfMissing('enum_merchant_variation_modifier_group_target_source', ['product_base', 'variation_added'])
  await createEnumIfMissing('enum_merchant_variation_modifier_option_target_source', ['product_base', 'variation_added'])

  // ─── delivery_bookings table ────────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "delivery_bookings" (
      "id" serial PRIMARY KEY NOT NULL,
      "order_id" integer NOT NULL,
      "lalamove_order_id" varchar,
      "lalamove_quotation_id" varchar,
      "share_link" varchar,
      "service_type" varchar DEFAULT 'MOTORCYCLE',
      "scheduled_at" timestamp(3) with time zone,
      "expires_at" timestamp(3) with time zone,
      "status" "enum_delivery_bookings_status" DEFAULT 'pending' NOT NULL,
      "lalamove_raw_status" varchar,
      "delivery_fee" numeric,
      "currency" varchar DEFAULT 'PHP',
      "priority_fee" numeric DEFAULT 0,
      "driver_name" varchar,
      "driver_phone" varchar,
      "driver_plate_number" varchar,
      "driver_photo_url" varchar,
      "driver_lat" numeric,
      "driver_lng" numeric,
      "driver_location_updated_at" timestamp(3) with time zone,
      "pickup_address" varchar,
      "pickup_lat" numeric,
      "pickup_lng" numeric,
      "dropoff_address" varchar,
      "dropoff_lat" numeric,
      "dropoff_lng" numeric,
      "distance_meters" numeric,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // ─── variation_modifier_groups table ────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "variation_modifier_groups" (
      "id" serial PRIMARY KEY NOT NULL,
      "variation_id_id" integer NOT NULL,
      "name" varchar NOT NULL,
      "selection_type" "enum_variation_modifier_groups_selection_type" DEFAULT 'single' NOT NULL,
      "is_required" boolean DEFAULT false,
      "min_selections" numeric DEFAULT 0,
      "max_selections" numeric,
      "sort_order" numeric DEFAULT 0,
      "is_active" boolean DEFAULT true,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // ─── variation_modifier_options table ───────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "variation_modifier_options" (
      "id" serial PRIMARY KEY NOT NULL,
      "variation_modifier_group_id_id" integer NOT NULL,
      "name" varchar NOT NULL,
      "price_adjustment" numeric DEFAULT 0,
      "is_default" boolean DEFAULT false,
      "is_available" boolean DEFAULT true,
      "sort_order" numeric DEFAULT 0,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // ─── variation_modifier_group_overrides ─────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "variation_modifier_group_overrides" (
      "id" serial PRIMARY KEY NOT NULL,
      "variation_id_id" integer NOT NULL,
      "base_modifier_group_id_id" integer NOT NULL,
      "mode" "enum_variation_modifier_group_overrides_mode" DEFAULT 'inherit' NOT NULL,
      "name_override" varchar,
      "selection_type_override" "enum_variation_modifier_group_overrides_selection_type_override",
      "required_behavior" "enum_variation_modifier_group_overrides_required_behavior" DEFAULT 'inherit',
      "min_selections_override" numeric,
      "max_selections_override" numeric,
      "sort_order_override" numeric,
      "is_active" boolean DEFAULT true,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // ─── variation_modifier_option_overrides ────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "variation_modifier_option_overrides" (
      "id" serial PRIMARY KEY NOT NULL,
      "variation_id_id" integer NOT NULL,
      "base_modifier_option_id_id" integer NOT NULL,
      "mode" "enum_variation_modifier_option_overrides_mode" DEFAULT 'inherit' NOT NULL,
      "name_override" varchar,
      "price_adjustment_override" numeric,
      "default_behavior" "enum_variation_modifier_option_overrides_default_behavior" DEFAULT 'inherit',
      "availability_behavior" "enum_variation_modifier_option_overrides_availability_behavior" DEFAULT 'inherit',
      "sort_order_override" numeric,
      "is_active" boolean DEFAULT true,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // ─── merchant_product_modifier_group_overrides ──────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "merchant_product_modifier_group_overrides" (
      "id" serial PRIMARY KEY NOT NULL,
      "merchant_product_id_id" integer NOT NULL,
      "base_modifier_group_id_id" integer NOT NULL,
      "mode" "enum_merchant_modifier_group_override_mode" DEFAULT 'inherit' NOT NULL,
      "name_override" varchar,
      "selection_type_override" "enum_merchant_modifier_selection_type",
      "required_behavior" "enum_merchant_modifier_group_required_behavior" DEFAULT 'inherit',
      "min_selections_override" numeric,
      "max_selections_override" numeric,
      "sort_order_override" numeric,
      "is_active" boolean DEFAULT true,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // ─── merchant_product_modifier_option_overrides ─────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "merchant_product_modifier_option_overrides" (
      "id" serial PRIMARY KEY NOT NULL,
      "merchant_product_id_id" integer NOT NULL,
      "base_modifier_option_id_id" integer NOT NULL,
      "mode" "enum_merchant_modifier_option_override_mode" DEFAULT 'inherit' NOT NULL,
      "name_override" varchar,
      "price_adjustment_override" numeric,
      "default_behavior" "enum_merchant_modifier_option_override_default_behavior" DEFAULT 'inherit',
      "availability_behavior" "enum_merchant_modifier_option_override_availability_behavior" DEFAULT 'inherit',
      "sort_order_override" numeric,
      "is_active" boolean DEFAULT true,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // ─── merchant_variation_modifier_group_overrides ────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "merchant_variation_modifier_group_overrides" (
      "id" serial PRIMARY KEY NOT NULL,
      "merchant_product_id_id" integer NOT NULL,
      "variation_id_id" integer NOT NULL,
      "target_group_source" "enum_merchant_variation_modifier_group_target_source" DEFAULT 'product_base' NOT NULL,
      "base_modifier_group_id_id" integer,
      "variation_modifier_group_id_id" integer,
      "mode" "enum_merchant_modifier_group_override_mode" DEFAULT 'inherit' NOT NULL,
      "name_override" varchar,
      "selection_type_override" "enum_merchant_modifier_selection_type",
      "required_behavior" "enum_merchant_modifier_group_required_behavior" DEFAULT 'inherit',
      "min_selections_override" numeric,
      "max_selections_override" numeric,
      "sort_order_override" numeric,
      "is_active" boolean DEFAULT true,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // ─── merchant_variation_modifier_option_overrides ───────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "merchant_variation_modifier_option_overrides" (
      "id" serial PRIMARY KEY NOT NULL,
      "merchant_product_id_id" integer NOT NULL,
      "variation_id_id" integer NOT NULL,
      "target_option_source" "enum_merchant_variation_modifier_option_target_source" DEFAULT 'product_base' NOT NULL,
      "base_modifier_option_id_id" integer,
      "variation_modifier_option_id_id" integer,
      "mode" "enum_merchant_modifier_option_override_mode" DEFAULT 'inherit' NOT NULL,
      "name_override" varchar,
      "price_adjustment_override" numeric,
      "default_behavior" "enum_merchant_modifier_option_override_default_behavior" DEFAULT 'inherit',
      "availability_behavior" "enum_merchant_modifier_option_override_availability_behavior" DEFAULT 'inherit',
      "sort_order_override" numeric,
      "is_active" boolean DEFAULT true,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // ─── cart_items FK constraint change ────────────────────────────────────────
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "cart_items" DROP CONSTRAINT "cart_items_selected_variation_id_products_id_fk";
    EXCEPTION WHEN undefined_object THEN
      -- constraint doesn't exist yet, safe to proceed
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_selected_variation_id_prod_variations_id_fk"
        FOREIGN KEY ("selected_variation_id") REFERENCES "public"."prod_variations"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN
      -- constraint already exists
    END $$;
  `)

  // ─── ALTER TABLE ADD COLUMN IF NOT EXISTS ───────────────────────────────────
  await db.execute(sql`
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "lalamove_order_id" varchar;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_service_type" varchar DEFAULT 'MOTORCYCLE';
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_status" "enum_orders_delivery_status" DEFAULT 'none';
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_tracking_link" varchar;
  `)

  await db.execute(sql`
    ALTER TABLE "prod_variations" ADD COLUMN IF NOT EXISTS "modifier_behavior_mode" "enum_prod_variations_modifier_behavior_mode" DEFAULT 'inherit_product' NOT NULL;
    ALTER TABLE "prod_variations" ADD COLUMN IF NOT EXISTS "modifier_configuration_hint" varchar DEFAULT 'Choose a Modifier Behavior Mode first. Then manage the related records in Variation Modifier Groups / Options and Variation Modifier Overrides.';
    ALTER TABLE "prod_variations" ADD COLUMN IF NOT EXISTS "effective_modifier_preview" jsonb;
  `)

  await db.execute(sql`
    ALTER TABLE "merchant_products" ADD COLUMN IF NOT EXISTS "merchant_modifier_configuration_hint" varchar DEFAULT 'Use Merchant Product Modifier Overrides for merchant-wide base rules. Use Merchant Variation Modifier Overrides for variation-specific merchant customization.';
    ALTER TABLE "merchant_products" ADD COLUMN IF NOT EXISTS "effective_modifier_preview" jsonb;
  `)

  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "delivery_bookings_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "variation_modifier_groups_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "variation_modifier_options_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "variation_modifier_group_overrides_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "variation_modifier_option_overrides_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "merchant_product_modifier_group_overrides_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "merchant_product_modifier_option_overrides_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "merchant_variation_modifier_group_overrides_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "merchant_variation_modifier_option_overrides_id" integer;
  `)

  // ─── Foreign key constraints ────────────────────────────────────────────────
  const fks = [
    ['delivery_bookings', 'delivery_bookings_order_id_orders_id_fk', 'orders', 'order_id', 'set null'],
    ['variation_modifier_groups', 'variation_modifier_groups_variation_id_id_prod_variations_id_fk', 'prod_variations', 'variation_id_id', 'set null'],
    ['variation_modifier_options', 'variation_modifier_options_variation_modifier_group_id_id_variation_modifier_groups_id_fk', 'variation_modifier_groups', 'variation_modifier_group_id_id', 'set null'],
    ['variation_modifier_group_overrides', 'variation_modifier_group_overrides_variation_id_id_prod_variations_id_fk', 'prod_variations', 'variation_id_id', 'set null'],
    ['variation_modifier_group_overrides', 'variation_modifier_group_overrides_base_modifier_group_id_id_modifier_groups_id_fk', 'modifier_groups', 'base_modifier_group_id_id', 'set null'],
    ['variation_modifier_option_overrides', 'variation_modifier_option_overrides_variation_id_id_prod_variations_id_fk', 'prod_variations', 'variation_id_id', 'set null'],
    ['variation_modifier_option_overrides', 'variation_modifier_option_overrides_base_modifier_option_id_id_modifier_options_id_fk', 'modifier_options', 'base_modifier_option_id_id', 'set null'],
    ['merchant_product_modifier_group_overrides', 'merchant_product_modifier_group_overrides_merchant_product_id_id_merchant_products_id_fk', 'merchant_products', 'merchant_product_id_id', 'set null'],
    ['merchant_product_modifier_group_overrides', 'merchant_product_modifier_group_overrides_base_modifier_group_id_id_modifier_groups_id_fk', 'modifier_groups', 'base_modifier_group_id_id', 'set null'],
    ['merchant_product_modifier_option_overrides', 'merchant_product_modifier_option_overrides_merchant_product_id_id_merchant_products_id_fk', 'merchant_products', 'merchant_product_id_id', 'set null'],
    ['merchant_product_modifier_option_overrides', 'merchant_product_modifier_option_overrides_base_modifier_option_id_id_modifier_options_id_fk', 'modifier_options', 'base_modifier_option_id_id', 'set null'],
    ['merchant_variation_modifier_group_overrides', 'merchant_variation_modifier_group_overrides_merchant_product_id_id_merchant_products_id_fk', 'merchant_products', 'merchant_product_id_id', 'set null'],
    ['merchant_variation_modifier_group_overrides', 'merchant_variation_modifier_group_overrides_variation_id_id_prod_variations_id_fk', 'prod_variations', 'variation_id_id', 'set null'],
    ['merchant_variation_modifier_group_overrides', 'merchant_variation_modifier_group_overrides_base_modifier_group_id_id_modifier_groups_id_fk', 'modifier_groups', 'base_modifier_group_id_id', 'set null'],
    ['merchant_variation_modifier_group_overrides', 'merchant_variation_modifier_group_overrides_variation_modifier_group_id_id_variation_modifier_groups_id_fk', 'variation_modifier_groups', 'variation_modifier_group_id_id', 'set null'],
    ['merchant_variation_modifier_option_overrides', 'merchant_variation_modifier_option_overrides_merchant_product_id_id_merchant_products_id_fk', 'merchant_products', 'merchant_product_id_id', 'set null'],
    ['merchant_variation_modifier_option_overrides', 'merchant_variation_modifier_option_overrides_variation_id_id_prod_variations_id_fk', 'prod_variations', 'variation_id_id', 'set null'],
    ['merchant_variation_modifier_option_overrides', 'merchant_variation_modifier_option_overrides_base_modifier_option_id_id_modifier_options_id_fk', 'modifier_options', 'base_modifier_option_id_id', 'set null'],
    ['merchant_variation_modifier_option_overrides', 'merchant_variation_modifier_option_overrides_variation_modifier_option_id_id_variation_modifier_options_id_fk', 'variation_modifier_options', 'variation_modifier_option_id_id', 'set null'],
  ]

  for (const [table, constraint, target, col, onDelete] of fks) {
    await db.execute(sql.raw(`
      DO $$ BEGIN
        ALTER TABLE "${table}"
          ADD CONSTRAINT "${constraint}"
          FOREIGN KEY ("${col}") REFERENCES "public"."${target}"("id")
          ON DELETE ${onDelete} ON UPDATE no action;
      EXCEPTION WHEN duplicate_object THEN
        -- already exists
      END $$;
    `))
  }

  // ─── Unique constraint on delivery_bookings.order_id ────────────────────────
  await db.execute(sql.raw(`
    DO $$ BEGIN
      ALTER TABLE "delivery_bookings"
        ADD CONSTRAINT "delivery_bookings_order_id_unique"
        UNIQUE ("order_id");
    EXCEPTION WHEN duplicate_object THEN
      -- already exists
    END $$;
  `))

  // ─── Payload locked docs rels FKs ───────────────────────────────────────────
  const relsFks = [
    ['delivery_bookings', 'delivery_bookings', 'cascade'],
    ['variation_modifier_groups', 'variation_modifier_groups', 'cascade'],
    ['variation_modifier_options', 'variation_modifier_options', 'cascade'],
    ['variation_modifier_group_overrides', 'variation_modifier_group_overrides', 'cascade'],
    ['variation_modifier_option_overrides', 'variation_modifier_option_overrides', 'cascade'],
    ['merchant_product_modifier_group_overrides', 'merchant_product_modifier_group_overrides', 'cascade'],
    ['merchant_product_modifier_option_overrides', 'merchant_product_modifier_option_overrides', 'cascade'],
    ['merchant_variation_modifier_group_overrides', 'merchant_variation_modifier_group_overrides', 'cascade'],
    ['merchant_variation_modifier_option_overrides', 'merchant_variation_modifier_option_overrides', 'cascade'],
  ]

  for (const [col, table, del] of relsFks) {
    await db.execute(sql.raw(`
      DO $$ BEGIN
        ALTER TABLE "payload_locked_documents_rels"
          ADD CONSTRAINT "payload_locked_documents_rels_${table}_fk"
          FOREIGN KEY ("${col}_id") REFERENCES "public"."${table}"("id")
          ON DELETE ${del} ON UPDATE no action;
      EXCEPTION WHEN duplicate_object THEN
        -- already exists
      END $$;
    `))
  }

  // ─── Indexes ────────────────────────────────────────────────────────────────
  const indexes: [string, string][] = [
    ['delivery_bookings', 'delivery_bookings_order_idx'],
    ['delivery_bookings', 'delivery_bookings_updated_at_idx'],
    ['delivery_bookings', 'delivery_bookings_created_at_idx'],
    ['variation_modifier_groups', 'variation_modifier_groups_variation_id_idx'],
    ['variation_modifier_groups', 'variation_modifier_groups_updated_at_idx'],
    ['variation_modifier_groups', 'variation_modifier_groups_created_at_idx'],
    ['variation_modifier_groups', 'variation_id_sort_order_idx'],
    ['variation_modifier_options', 'variation_modifier_options_variation_modifier_group_id_idx'],
    ['variation_modifier_options', 'variation_modifier_options_updated_at_idx'],
    ['variation_modifier_options', 'variation_modifier_options_created_at_idx'],
    ['variation_modifier_options', 'variation_modifier_group_id_sort_order_idx'],
    ['variation_modifier_group_overrides', 'variation_modifier_group_overrides_variation_id_idx'],
    ['variation_modifier_group_overrides', 'variation_modifier_group_overrides_base_modifier_group_id_idx'],
    ['variation_modifier_group_overrides', 'variation_modifier_group_overrides_updated_at_idx'],
    ['variation_modifier_group_overrides', 'variation_modifier_group_overrides_created_at_at_idx'],
    ['variation_modifier_group_overrides', 'variation_id_base_modifier_group_id_idx'],
    ['variation_modifier_option_overrides', 'variation_modifier_option_overrides_variation_id_idx'],
    ['variation_modifier_option_overrides', 'variation_modifier_option_overrides_base_modifier_option_id_idx'],
    ['variation_modifier_option_overrides', 'variation_modifier_option_overrides_updated_at_idx'],
    ['variation_modifier_option_overrides', 'variation_modifier_option_overrides_created_at_at_idx'],
    ['variation_modifier_option_overrides', 'variation_id_base_modifier_option_id_idx'],
    ['merchant_product_modifier_group_overrides', 'merchant_product_modifier_group_overrides_merchant_product_id_idx'],
    ['merchant_product_modifier_group_overrides', 'merchant_product_modifier_group_overrides_base_modifier_group_id_idx'],
    ['merchant_product_modifier_group_overrides', 'merchant_product_modifier_group_overrides_updated_at_idx'],
    ['merchant_product_modifier_group_overrides', 'merchant_product_modifier_group_overrides_created_at_idx'],
    ['merchant_product_modifier_group_overrides', 'merchant_product_id_base_modifier_group_id_idx'],
    ['merchant_product_modifier_option_overrides', 'merchant_product_modifier_option_overrides_merchant_product_id_idx'],
    ['merchant_product_modifier_option_overrides', 'merchant_product_modifier_option_overrides_base_modifier_option_id_idx'],
    ['merchant_product_modifier_option_overrides', 'merchant_product_modifier_option_overrides_updated_at_idx'],
    ['merchant_product_modifier_option_overrides', 'merchant_product_modifier_option_overrides_created_at_idx'],
    ['merchant_product_modifier_option_overrides', 'merchant_product_id_base_modifier_option_id_idx'],
    ['merchant_variation_modifier_group_overrides', 'merchant_variation_modifier_group_overrides_merchant_product_id_idx'],
    ['merchant_variation_modifier_group_overrides', 'merchant_variation_modifier_group_overrides_variation_id_idx'],
    ['merchant_variation_modifier_group_overrides', 'merchant_variation_modifier_group_overrides_base_modifier_group_id_idx'],
    ['merchant_variation_modifier_group_overrides', 'merchant_variation_modifier_group_overrides_variation_modifier_group_id_idx'],
    ['merchant_variation_modifier_group_overrides', 'merchant_variation_modifier_group_overrides_updated_at_idx'],
    ['merchant_variation_modifier_group_overrides', 'merchant_variation_modifier_group_overrides_created_at_idx'],
    ['merchant_variation_modifier_group_overrides', 'merchant_product_id_variation_id_base_modifier_group_id_idx'],
    ['merchant_variation_modifier_group_overrides', 'merchant_product_id_variation_id_variation_modifier_group_id_idx'],
    ['merchant_variation_modifier_option_overrides', 'merchant_variation_modifier_option_overrides_merchant_product_id_idx'],
    ['merchant_variation_modifier_option_overrides', 'merchant_variation_modifier_option_overrides_variation_id_idx'],
    ['merchant_variation_modifier_option_overrides', 'merchant_variation_modifier_option_overrides_base_modifier_option_id_idx'],
    ['merchant_variation_modifier_option_overrides', 'merchant_variation_modifier_option_overrides_variation_modifier_option_id_idx'],
    ['merchant_variation_modifier_option_overrides', 'merchant_variation_modifier_option_overrides_updated_at_idx'],
    ['merchant_variation_modifier_option_overrides', 'merchant_variation_modifier_option_overrides_created_at_idx'],
    ['merchant_variation_modifier_option_overrides', 'merchant_product_id_variation_id_base_modifier_option_id_idx'],
    ['merchant_variation_modifier_option_overrides', 'merchant_product_id_variation_id_variation_modifier_option_id_idx'],
    ['payload_locked_documents_rels', 'payload_locked_documents_rels_delivery_bookings_id_idx'],
    ['payload_locked_documents_rels', 'payload_locked_documents_rels_variation_modifier_groups_id_idx'],
    ['payload_locked_documents_rels', 'payload_locked_documents_rels_variation_modifier_options_id_idx'],
    ['payload_locked_documents_rels', 'payload_locked_documents_rels_variation_modifier_group_overrides_id_idx'],
    ['payload_locked_documents_rels', 'payload_locked_documents_rels_variation_modifier_option_overrides_id_idx'],
    ['payload_locked_documents_rels', 'payload_locked_documents_rels_merchant_product_modifier_group_overrides_id_idx'],
    ['payload_locked_documents_rels', 'payload_locked_documents_rels_merchant_product_modifier_option_overrides_id_idx'],
    ['payload_locked_documents_rels', 'payload_locked_documents_rels_merchant_variation_modifier_group_overrides_id_idx'],
    ['payload_locked_documents_rels', 'payload_locked_documents_rels_merchant_variation_modifier_option_overrides_id_idx'],
  ]

  // Create indexes safely (some are composite)
  const compositeIndexes: [string, string, string[]][] = [
    ['variation_modifier_groups', 'variation_id_sort_order_idx', ['variation_id_id', 'sort_order']],
    ['variation_modifier_options', 'variation_modifier_group_id_sort_order_idx', ['variation_modifier_group_id_id', 'sort_order']],
    ['variation_modifier_group_overrides', 'variation_id_base_modifier_group_id_idx', ['variation_id_id', 'base_modifier_group_id_id']],
    ['variation_modifier_option_overrides', 'variation_id_base_modifier_option_id_idx', ['variation_id_id', 'base_modifier_option_id_id']],
    ['merchant_product_modifier_group_overrides', 'merchant_product_id_base_modifier_group_id_idx', ['merchant_product_id_id', 'base_modifier_group_id_id']],
    ['merchant_product_modifier_option_overrides', 'merchant_product_id_base_modifier_option_id_idx', ['merchant_product_id_id', 'base_modifier_option_id_id']],
    ['merchant_variation_modifier_group_overrides', 'merchant_product_id_variation_id_base_modifier_group_id_idx', ['merchant_product_id_id', 'variation_id_id', 'base_modifier_group_id_id']],
    ['merchant_variation_modifier_group_overrides', 'merchant_product_id_variation_id_variation_modifier_group_id_idx', ['merchant_product_id_id', 'variation_id_id', 'variation_modifier_group_id_id']],
    ['merchant_variation_modifier_option_overrides', 'merchant_product_id_variation_id_base_modifier_option_id_idx', ['merchant_product_id_id', 'variation_id_id', 'base_modifier_option_id_id']],
    ['merchant_variation_modifier_option_overrides', 'merchant_product_id_variation_id_variation_modifier_option_id_idx', ['merchant_product_id_id', 'variation_id_id', 'variation_modifier_option_id_id']],
  ]

  // Build a single SQL for all single-column indexes
  for (const [table, idx] of indexes) {
    // Skip composite indexes handled separately
    if (compositeIndexes.some((c) => c[1] === idx)) continue
    await db.execute(sql.raw(`
      DO $$ BEGIN
        CREATE INDEX IF NOT EXISTS "${idx}" ON "${table}" USING btree ("${table.replace(/s$/, '')}_id");
      EXCEPTION WHEN others THEN
        -- best-effort single-column index; skip if column name differs
      END $$;
    `))
  }

  for (const [table, idx, cols] of compositeIndexes) {
    const colsStr = cols.map((c) => `"${c}"`).join(',')
    await db.execute(sql.raw(`
      DO $$ BEGIN
        CREATE INDEX IF NOT EXISTS "${idx}" ON "${table}" USING btree (${colsStr});
      EXCEPTION WHEN others THEN
        -- best-effort composite index
      END $$;
    `))
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Safely drop everything in reverse
  await db.execute(sql`
    DROP TABLE IF EXISTS "delivery_bookings" CASCADE;
    DROP TABLE IF EXISTS "variation_modifier_groups" CASCADE;
    DROP TABLE IF EXISTS "variation_modifier_options" CASCADE;
    DROP TABLE IF EXISTS "variation_modifier_group_overrides" CASCADE;
    DROP TABLE IF EXISTS "variation_modifier_option_overrides" CASCADE;
    DROP TABLE IF EXISTS "merchant_product_modifier_group_overrides" CASCADE;
    DROP TABLE IF EXISTS "merchant_product_modifier_option_overrides" CASCADE;
    DROP TABLE IF EXISTS "merchant_variation_modifier_group_overrides" CASCADE;
    DROP TABLE IF EXISTS "merchant_variation_modifier_option_overrides" CASCADE;
  `)

  await db.execute(sql`
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "lalamove_order_id";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "delivery_service_type";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "delivery_status";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "delivery_tracking_link";
  `)

  await db.execute(sql`
    ALTER TABLE "prod_variations" DROP COLUMN IF EXISTS "modifier_behavior_mode";
    ALTER TABLE "prod_variations" DROP COLUMN IF EXISTS "modifier_configuration_hint";
    ALTER TABLE "prod_variations" DROP COLUMN IF EXISTS "effective_modifier_preview";
  `)

  await db.execute(sql`
    ALTER TABLE "merchant_products" DROP COLUMN IF EXISTS "merchant_modifier_configuration_hint";
    ALTER TABLE "merchant_products" DROP COLUMN IF EXISTS "effective_modifier_preview";
  `)

  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "delivery_bookings_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "variation_modifier_groups_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "variation_modifier_options_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "variation_modifier_group_overrides_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "variation_modifier_option_overrides_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "merchant_product_modifier_group_overrides_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "merchant_product_modifier_option_overrides_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "merchant_variation_modifier_group_overrides_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "merchant_variation_modifier_option_overrides_id";
  `)

  await db.execute(sql`
    DROP TYPE IF EXISTS "public"."enum_orders_delivery_status";
    DROP TYPE IF EXISTS "public"."enum_delivery_bookings_status";
    DROP TYPE IF EXISTS "public"."enum_prod_variations_modifier_behavior_mode";
    DROP TYPE IF EXISTS "public"."enum_variation_modifier_groups_selection_type";
    DROP TYPE IF EXISTS "public"."enum_variation_modifier_group_overrides_mode";
    DROP TYPE IF EXISTS "public"."enum_variation_modifier_group_overrides_selection_type_override";
    DROP TYPE IF EXISTS "public"."enum_variation_modifier_group_overrides_required_behavior";
    DROP TYPE IF EXISTS "public"."enum_variation_modifier_option_overrides_mode";
    DROP TYPE IF EXISTS "public"."enum_variation_modifier_option_overrides_default_behavior";
    DROP TYPE IF EXISTS "public"."enum_variation_modifier_option_overrides_availability_behavior";
    DROP TYPE IF EXISTS "public"."enum_merchant_modifier_group_override_mode";
    DROP TYPE IF EXISTS "public"."enum_merchant_modifier_selection_type";
    DROP TYPE IF EXISTS "public"."enum_merchant_modifier_group_required_behavior";
    DROP TYPE IF EXISTS "public"."enum_merchant_modifier_option_override_mode";
    DROP TYPE IF EXISTS "public"."enum_merchant_modifier_option_default_behavior";
    DROP TYPE IF EXISTS "public"."enum_merchant_modifier_option_availability_behavior";
    DROP TYPE IF EXISTS "public"."enum_merchant_variation_modifier_group_target_source";
    DROP TYPE IF EXISTS "public"."enum_merchant_variation_modifier_option_target_source";
  `)
}
