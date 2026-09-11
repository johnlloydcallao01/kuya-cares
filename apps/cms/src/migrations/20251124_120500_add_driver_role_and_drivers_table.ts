import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TYPE "enum_users_role" ADD VALUE 'driver';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE enum_drivers_status AS ENUM ('offline','online','on_delivery','paused');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE enum_drivers_vehicle_type AS ENUM ('bicycle','motorcycle','scooter','car');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS drivers (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      status enum_drivers_status DEFAULT 'offline',
      is_active BOOLEAN DEFAULT TRUE,
      onboarding_date TIMESTAMPTZ,
      license_number VARCHAR NOT NULL UNIQUE,
      license_expiry DATE,
      vehicle_type enum_drivers_vehicle_type,
      vehicle_model VARCHAR,
      vehicle_plate_number VARCHAR UNIQUE,
      vehicle_color VARCHAR,
      rating_average NUMERIC DEFAULT 0,
      total_deliveries INTEGER DEFAULT 0,
      current_latitude NUMERIC,
      current_longitude NUMERIC,
      current_coordinates JSONB,
      preferred_service_radius_meters NUMERIC,
      service_area JSONB,
      active_address_id INTEGER REFERENCES addresses(id) ON DELETE SET NULL,
      driving_license_image_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
      vehicle_registration_image_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
  `)

  await db.execute(sql`CREATE INDEX IF NOT EXISTS drivers_user_id_idx ON drivers(user_id);`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS drivers_status_idx ON drivers(status);`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS drivers_is_active_idx ON drivers(is_active);`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS drivers_location_idx ON drivers(current_latitude, current_longitude);`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS drivers_plate_idx ON drivers(vehicle_plate_number);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS drivers CASCADE;`)

  await db.execute(sql`
    DO $$ BEGIN
      DROP TYPE enum_drivers_status;
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      DROP TYPE enum_drivers_vehicle_type;
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;
  `)
}

