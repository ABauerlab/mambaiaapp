CREATE OR REPLACE FUNCTION public.is_team_member()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid())
$$;
REVOKE EXECUTE ON FUNCTION public.is_team_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_team_member() TO authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['transacoes','acertos','gastos_fixos','quadro_itens','socios','categorias','alertas'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS auth_all ON public.%I', t);
    EXECUTE format('CREATE POLICY team_all ON public.%I FOR ALL TO authenticated USING (public.is_team_member()) WITH CHECK (public.is_team_member())', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS notif_log_select ON public.notificacoes_log;
CREATE POLICY notif_log_select ON public.notificacoes_log FOR SELECT TO authenticated USING (public.is_team_member());

DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_team_member());

DROP POLICY IF EXISTS "Admins gerenciam reservas" ON public.reservas;
CREATE POLICY "Admins gerenciam reservas" ON public.reservas FOR ALL TO authenticated
  USING (public.is_team_member()) WITH CHECK (public.is_team_member());

DROP POLICY IF EXISTS "Autenticados podem atualizar cobrancas" ON public.cobrancas;
CREATE POLICY "Autenticados podem atualizar cobrancas" ON public.cobrancas FOR UPDATE TO authenticated
  USING (public.is_team_member()) WITH CHECK (public.is_team_member());