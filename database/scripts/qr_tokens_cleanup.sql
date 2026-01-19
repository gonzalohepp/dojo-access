-- Function to clean up old tokens
create or replace function public.cleanup_old_tokens()
returns trigger as $$
begin
  -- Delete tokens older than 2 days
  delete from public.qr_tokens
  where created_at < now() - interval '2 days';
  return new;
end;
$$ language plpgsql;

-- Trigger to run cleanup on every new token insertion
create trigger trigger_cleanup_old_tokens
  after insert on public.qr_tokens
  for each statement
  execute function public.cleanup_old_tokens();
