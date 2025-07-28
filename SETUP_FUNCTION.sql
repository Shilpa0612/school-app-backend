-- Create school_details table
create table public.school_details (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    address text not null,
    contact_number text not null,
    email text not null,
    board text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.school_details enable row level security;

-- Create policy
create policy "Anyone can view school details"
on public.school_details for select
using (true);

create policy "Only admin can modify school details"
on public.school_details for all
using (
    exists (
        select 1 from public.users
        where id = auth.uid()
        and role = 'admin'
    )
);

-- Create setup function
create or replace function public.setup_school(
    admin_data jsonb,
    school_data jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
    new_admin_id uuid;
    new_school_id uuid;
begin
    -- Check if setup is already done
    if exists (select 1 from public.users where role = 'admin')
    or exists (select 1 from public.school_details) then
        raise exception 'Setup has already been completed';
    end if;

    -- Begin transaction
    begin
        -- Create admin user
        insert into public.users (
            phone_number,
            password_hash,
            role,
            full_name,
            email,
            preferred_language
        )
        values (
            (admin_data->>'phone_number')::text,
            (admin_data->>'password_hash')::text,
            'admin',
            (admin_data->>'full_name')::text,
            (admin_data->>'email')::text,
            'english'
        )
        returning id into new_admin_id;

        -- Create school details
        insert into public.school_details (
            name,
            address,
            contact_number,
            email,
            board
        )
        values (
            (school_data->>'name')::text,
            (school_data->>'address')::text,
            (school_data->>'contact_number')::text,
            (school_data->>'email')::text,
            (school_data->>'board')::text
        )
        returning id into new_school_id;

        return jsonb_build_object(
            'admin_id', new_admin_id,
            'school_id', new_school_id
        );
    exception
        when others then
            -- Rollback will happen automatically
            raise exception 'Setup failed: %', SQLERRM;
    end;
end;
$$; 