import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "email" varchar;

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
          END IF;
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
        RETURN NEW;
      END IF;

      RETURN NEW;
    END
    $$ LANGUAGE plpgsql;

    DO $$
    DECLARE
      trg RECORD;
    BEGIN
      FOR trg IN
        SELECT t.tgname
        FROM pg_trigger t
        JOIN pg_proc p ON p.oid = t.tgfoid
        WHERE t.tgrelid = 'public.users'::regclass
          AND NOT t.tgisinternal
          AND p.proname = 'handle_role_change'
      LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.users', trg.tgname);
      END LOOP;

      DROP TRIGGER IF EXISTS trg_users_handle_role_change_insert ON public.users;
      DROP TRIGGER IF EXISTS trg_users_handle_role_change_update ON public.users;

      CREATE TRIGGER trg_users_handle_role_change_insert
        AFTER INSERT ON public.users
        FOR EACH ROW
        EXECUTE FUNCTION handle_role_change();

      CREATE TRIGGER trg_users_handle_role_change_update
        AFTER UPDATE OF role ON public.users
        FOR EACH ROW
        EXECUTE FUNCTION handle_role_change();
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TRIGGER IF EXISTS trg_users_handle_role_change_insert ON public.users;
    DROP TRIGGER IF EXISTS trg_users_handle_role_change_update ON public.users;
  `)
}

