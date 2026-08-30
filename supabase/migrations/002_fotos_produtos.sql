-- =====================================================================
-- THE PET HOUSE - Fotos dos produtos
-- Rode no Supabase > SQL Editor > New query > Run. Pode rodar de novo
-- sem problema. Cria o balde de arquivos onde as fotos vao morar.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'produtos',
  'produtos',
  true,
  3145728,                                              -- 3 MB por arquivo
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 3145728,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Mesma postura das outras tabelas do projeto: a chave publica pode
-- ler e gravar. Vale so para o balde 'produtos'.
drop policy if exists produtos_leitura  on storage.objects;
drop policy if exists produtos_envio    on storage.objects;
drop policy if exists produtos_troca    on storage.objects;
drop policy if exists produtos_remocao  on storage.objects;

create policy produtos_leitura on storage.objects
  for select to anon, authenticated using (bucket_id = 'produtos');

create policy produtos_envio on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'produtos');

create policy produtos_troca on storage.objects
  for update to anon, authenticated using (bucket_id = 'produtos') with check (bucket_id = 'produtos');

create policy produtos_remocao on storage.objects
  for delete to anon, authenticated using (bucket_id = 'produtos');
