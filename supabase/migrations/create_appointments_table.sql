-- Create the appointments table
create table public.appointments (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    client_id uuid references auth.users(id) on delete cascade not null,
    establishment_id uuid references auth.users(id) on delete cascade not null,
    establishment_name text not null,
    service_name text not null,
    service_price decimal(10,2) not null,
    professional_name text,
    appointment_date date not null,
    appointment_time time not null,
    duration integer,
    status text default 'pending' check (status in ('pending', 'confirmed', 'cancelled')) not null
);

-- Set up Row Level Security (RLS)
alter table public.appointments enable row level security;

-- Create policies
create policy "Users can view their own appointments"
    on public.appointments for select
    using (
        auth.uid() = client_id or 
        auth.uid() = establishment_id
    );

create policy "Clients can create appointments"
    on public.appointments for insert
    with check (auth.uid() = client_id);

create policy "Clients can cancel their own appointments"
    on public.appointments for update
    using (auth.uid() = client_id)
    with check (
        auth.uid() = client_id and 
        status = 'cancelled' and 
        old.status != 'cancelled'
    );

create policy "Establishments can manage appointment status"
    on public.appointments for update
    using (auth.uid() = establishment_id)
    with check (
        auth.uid() = establishment_id and 
        status in ('confirmed', 'cancelled')
    );

-- Create indexes for better performance
create index appointments_client_id_idx on public.appointments(client_id);
create index appointments_establishment_id_idx on public.appointments(establishment_id);
create index appointments_status_idx on public.appointments(status);
create index appointments_date_idx on public.appointments(appointment_date); 