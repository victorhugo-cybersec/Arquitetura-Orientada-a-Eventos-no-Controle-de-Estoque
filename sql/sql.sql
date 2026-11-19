CREATE TABLE IF NOT EXISTS public.produtos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    preco NUMERIC(10,2) NOT NULL DEFAULT 0,
    estoque INTEGER NOT NULL DEFAULT 0,
    estoque_minimo INTEGER NOT NULL DEFAULT 5,
    disponivel BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.movimentacoes_estoque (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evento_id UUID UNIQUE,
    produto_id UUID NOT NULL
        REFERENCES public.produtos(id) ON DELETE CASCADE,
    tipo VARCHAR(10) NOT NULL
        CHECK (tipo IN ('ENTRADA', 'SAIDA')),
    quantidade INTEGER NOT NULL
        CHECK (quantidade > 0),
    saldo_anterior INTEGER NOT NULL,
    saldo_atual INTEGER NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.alertas_reposicao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id UUID NOT NULL
        REFERENCES public.produtos(id) ON DELETE CASCADE,
    saldo_atual INTEGER NOT NULL,
    estoque_minimo INTEGER NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'PENDENTE'
        CHECK (status IN ('PENDENTE', 'RESOLVIDO')),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_produto
ON public.movimentacoes_estoque(produto_id);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_evento
ON public.movimentacoes_estoque(evento_id);

CREATE INDEX IF NOT EXISTS idx_alertas_produto
ON public.alertas_reposicao(produto_id);

CREATE INDEX IF NOT EXISTS idx_alertas_status
ON public.alertas_reposicao(status);

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.produtos TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.movimentacoes_estoque TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.alertas_reposicao TO anon, authenticated;
