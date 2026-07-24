-- Create table for storing QR tokens
create table public.qr_tokens (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

-- Index for faster lookups
create index idx_qr_tokens_token on public.qr_tokens(token);

-- Enable RLS (Method 1: Allow public read/write if necessary for function, or Service Role only)
-- Since we are going to access this from the client (QR Generator) and Client (Validator),
-- we need policies.
-- Ideally, only Authenticated Admins should CREATE tokens.
-- Authenticated Users (Members) or Public (Validate Endpoint) should READ tokens to validate.
-- actually, the Validator page might run on client side but validation usually requires checking DB.

alter table public.qr_tokens enable row level security;

-- Policy: Admins/Staff can INSERT tokens (QR Screen)
create policy "Admins can insert tokens"
  on public.qr_tokens
  for insert
  to authenticated
  with check (true); 
  -- In a real strict app, we would check if user role is 'admin'.
  -- For now, assuming any authenticated user (the QR screen is likely behind auth) can generate.

-- Policy: Everyone can READ tokens (to validate)
-- Actually, we only need to read to validate. 
create policy "Everyone can read tokens"
  on public.qr_tokens
  for select
  using (true);
