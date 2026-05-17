create table if not exists public.whatsapp_automation_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  reminder_enabled boolean not null default true,
  reminder_offset_minutes integer not null default 60 check (reminder_offset_minutes in (10, 30, 60, 180, 300, 720)),
  reminder_template text not null default
    'Olá, {{cliente_nome}}! 👋✨' || E'\n' ||
    'Passando para lembrar seu horário na {{barbearia_nome}}.' || E'\n' ||
    '⏰ Falta {{tempo_lembrete}} para seu atendimento de hoje às {{horario}}.' || E'\n' ||
    '📅 Data: {{data}}' || E'\n' ||
    '💈 Profissional: {{profissional_nome}}' || E'\n\n' ||
    'Te aguardamos! 🤝',
  greeting_enabled boolean not null default true,
  greeting_template text not null default
    'Opa, {{cliente_nome}}! 👋' || E'\n' ||
    'Obrigado por agendar na {{barbearia_nome}}. Ficamos muito felizes! 🙏' || E'\n\n' ||
    '📅 Data: {{data}}' || E'\n' ||
    '⏰ Horário: {{horario}}' || E'\n' ||
    '💈 Profissional: {{profissional_nome}}' || E'\n\n' ||
    'Qualquer dúvida, estamos por aqui no WhatsApp 💬',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_automation_settings enable row level security;

create policy "users_can_select_own_whatsapp_automation_settings"
on public.whatsapp_automation_settings
for select
to authenticated
using (auth.uid() = user_id);

create policy "users_can_insert_own_whatsapp_automation_settings"
on public.whatsapp_automation_settings
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "users_can_update_own_whatsapp_automation_settings"
on public.whatsapp_automation_settings
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists idx_whatsapp_automation_settings_user_id
  on public.whatsapp_automation_settings (user_id);
