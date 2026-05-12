-- 1. PROFILES
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  socio_id UUID REFERENCES public.socios(id) ON DELETE SET NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Trigger to auto-create profile on signup, linking to socio by email local part
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_local TEXT;
  v_socio_id UUID;
  v_display TEXT;
BEGIN
  v_local := lower(split_part(NEW.email, '@', 1));
  SELECT id, nome INTO v_socio_id, v_display
  FROM public.socios
  WHERE lower(split_part(nome, ' ', 1)) = v_local
     OR lower(replace(nome, ' ', '')) = v_local
  LIMIT 1;

  INSERT INTO public.profiles (user_id, display_name, socio_id, must_change_password)
  VALUES (
    NEW.id,
    COALESCE(v_display, split_part(NEW.email, '@', 1)),
    v_socio_id,
    true
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Storage bucket avatars (public)
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars_authenticated_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "avatars_authenticated_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "avatars_authenticated_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 4. participantes_ids em transacoes
ALTER TABLE public.transacoes ADD COLUMN participantes_ids UUID[] NOT NULL DEFAULT '{}';

-- 5. Replace open_all policies with authenticated-only on every business table
DROP POLICY IF EXISTS open_all ON public.transacoes;
DROP POLICY IF EXISTS open_all ON public.acertos;
DROP POLICY IF EXISTS open_all ON public.gastos_fixos;
DROP POLICY IF EXISTS open_all ON public.quadro_itens;
DROP POLICY IF EXISTS open_all ON public.socios;
DROP POLICY IF EXISTS open_all ON public.categorias;
DROP POLICY IF EXISTS open_all ON public.push_subscriptions;

CREATE POLICY auth_all ON public.transacoes      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all ON public.acertos         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all ON public.gastos_fixos    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all ON public.quadro_itens    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all ON public.socios          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all ON public.categorias      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all ON public.push_subscriptions FOR ALL TO authenticated USING (true) WITH CHECK (true);