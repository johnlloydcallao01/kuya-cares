import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION handle_role_change()
    RETURNS TRIGGER AS $$
    BEGIN
      IF TG_OP = 'UPDATE' THEN
        IF NEW.role IS DISTINCT FROM OLD.role THEN
          IF NEW.role = 'customer' THEN
            INSERT INTO customers (user_id, email)
            SELECT NEW.id, NEW.email
            WHERE NOT EXISTS (SELECT 1 FROM customers WHERE user_id = NEW.id);
          ELSIF NEW.role = 'admin' THEN
            INSERT INTO admins (user_id)
            SELECT NEW.id
            WHERE NOT EXISTS (SELECT 1 FROM admins WHERE user_id = NEW.id);
          ELSIF NEW.role = 'service' THEN
            NULL;
          ELSIF NEW.role = 'vendor' THEN
            NULL;
          ELSIF NEW.role = 'driver' THEN
            NULL;
          END IF;

          -- Logging to user_events is temporarily disabled to avoid FK issues
        END IF;
        RETURN NEW;
      ELSIF TG_OP = 'INSERT' THEN
        IF NEW.role = 'customer' THEN
          INSERT INTO customers (user_id, email)
          SELECT NEW.id, NEW.email
          WHERE NOT EXISTS (SELECT 1 FROM customers WHERE user_id = NEW.id);
        ELSIF NEW.role = 'admin' THEN
          INSERT INTO admins (user_id)
          SELECT NEW.id
          WHERE NOT EXISTS (SELECT 1 FROM admins WHERE user_id = NEW.id);
        END IF;

        -- Logging to user_events is temporarily disabled to avoid FK issues

        RETURN NEW;
      END IF;

      RETURN NEW;
    END
    $$ LANGUAGE plpgsql;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION handle_role_change()
    RETURNS TRIGGER AS $$
    BEGIN
      RETURN NEW;
    END
    $$ LANGUAGE plpgsql;
  `)
}

