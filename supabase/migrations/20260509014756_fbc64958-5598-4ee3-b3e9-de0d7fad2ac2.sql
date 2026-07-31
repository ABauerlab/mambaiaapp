
-- 1. Adicionar Kodara como sócio (cotista da Mambaia)
INSERT INTO public.socios (nome, cor, ordem)
SELECT 'Kodara', '#A6D608', 0
WHERE NOT EXISTS (SELECT 1 FROM public.socios WHERE nome = 'Kodara');

-- 2. Adicionar coluna responsavel_ids no quadro_itens (array)
ALTER TABLE public.quadro_itens
  ADD COLUMN IF NOT EXISTS responsavel_ids uuid[] NOT NULL DEFAULT '{}';

-- 3. Backfill: migrar responsavel_id (singular) para o array
UPDATE public.quadro_itens
SET responsavel_ids = ARRAY[responsavel_id]
WHERE responsavel_id IS NOT NULL
  AND (responsavel_ids IS NULL OR cardinality(responsavel_ids) = 0);
