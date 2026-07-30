# LYE Aqua Flow

SvelteKit dashboard for LYE water-meter owners and administrators.

## Local setup

1. Copy `.env.example` to `.env` and add the Supabase project URL and anon key.
2. In the Supabase SQL editor, run:
   - `supabase/migrations/202607300002_prepaid_water_core.sql`;
   - `supabase/migrations/202607300003_user_roles.sql`;
   - `supabase/migrations/202607300004_account_approval.sql`;
   - `supabase/migrations/202607300005_anon_admin_approval.sql`;
   - `supabase/migrations/202607300006_refresh_rls_policies.sql`.
3. Create the first account through `/signup`, then bootstrap the first
   administrator:

```sql
update public.profiles profile
set account_status = 'active', updated_at = now()
from auth.users auth_user
where auth_user.id = profile.id
  and auth_user.email = 'your-admin@example.com';

insert into public.profile_roles (profile_id, role_id)
select auth_user.id, role.id
from auth.users auth_user
cross join public.user_roles role
where auth_user.email = 'your-admin@example.com'
  and role.code = 'admin'
on conflict (profile_id, role_id) do nothing;
```

4. In Supabase Auth URL Configuration, add the app origin and
   `<app-origin>/auth/callback` to the allowed redirect URLs.
5. Install and start the app:

```sh
npm install
npm run dev
```

Password signup creates the Supabase Auth user, an approval-pending profile, and
the profile's `house-owner` role assignment. Active administrators approve new
accounts from `/admin/users`. Magic-link login remains restricted to existing
Supabase Auth users.

The migrations contain schema, constraints, seed data, views, grants, and
read-scoped RLS only. They create no runtime functions or triggers. All profile,
role, authorization, household, payment, credit, allocation, reading, and
ledger workflows run in `src/lib/server`.

The complete model and transaction flows are described in
`docs/prepaid-water-data-model.md`.

## Validation

```sh
npm run check
npm test
npm run build
```
