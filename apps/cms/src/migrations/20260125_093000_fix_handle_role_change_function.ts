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

          INSERT INTO user_events (user_id, event_type, event_data, timestamp)
          VALUES (
            NEW.id,
            'ROLE_CHANGED',
            json_build_object('oldRole', OLD.role, 'newRole', NEW.role),
            NOW()
          );
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

        INSERT INTO user_events (user_id, event_type, event_data, timestamp)
        VALUES (NEW.id, 'USER_CREATED', json_build_object('role', NEW.role), NOW());

        RETURN NEW;
      END IF;

      RETURN NEW;
    END
    $$ LANGUAGE plpgsql;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_handle_role_change_insert'
      ) THEN
        CREATE TRIGGER trg_users_handle_role_change_insert
        AFTER INSERT ON users
        FOR EACH ROW
        EXECUTE FUNCTION handle_role_change();
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_handle_role_change_update'
      ) THEN
        CREATE TRIGGER trg_users_handle_role_change_update
        AFTER UPDATE OF role ON users
        FOR EACH ROW
        EXECUTE FUNCTION handle_role_change();
      END IF;
    END $$;
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

