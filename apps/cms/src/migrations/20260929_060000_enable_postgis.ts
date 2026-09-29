import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Enable PostGIS for location-based merchant filtering.
 *
 * Installed into the dedicated `extensions` schema per Supabase docs —
 * NEVER public. A public install drops `spatial_ref_sys` (8500 stock
 * reference rows) into the app schema, where schema-push tools flag it
 * as an unmanaged table and offer to delete it (data-loss risk).
 * `search_path` ("$user", public, extensions) resolves unqualified ST_*
 * calls either way, so app queries are unaffected by placement.
 *
 * The home page (`location-based-display` -> GeospatialService
 * findMerchantsWithinRadiusPostGIS) runs ST_DWithin / ST_Distance /
 * ST_Transform / ST_GeomFromGeoJSON. Without this extension every such
 * query fails and location sections render empty. Idempotent.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE SCHEMA IF NOT EXISTS extensions;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `)
  await db.execute(sql`
    DO $$ BEGIN
      CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // PostGIS removal can break dependent objects; leave the extension
  // installed on rollback. Drop it manually only if no objects depend on it:
  //   DROP EXTENSION IF EXISTS postgis;
}
