-- Make Sebby's migrated account an active admin.
-- Run this after 001_schema.sql, 002_seed.sql, and 003_multitenant.sql.

update public.app_users
   set role = 'admin'::public.user_role,
       is_active = true,
       status = 'active'::public.user_status
 where lower(email) = 'sebbywakis@gmail.com';
