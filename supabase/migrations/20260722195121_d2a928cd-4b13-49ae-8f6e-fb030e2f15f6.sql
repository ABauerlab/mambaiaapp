
-- Zera financeiro (mantém reservas/cobranças/quadro)
DELETE FROM public.transacoes;
DELETE FROM public.acertos;

-- Nova divisão: 3 partes iguais entre Bauer, Laura, Ed
UPDATE public.socios SET nome = 'Bauer', ordem = 1 WHERE nome = 'João Victor';
DELETE FROM public.socios WHERE nome = 'Kodara';
