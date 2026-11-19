require("dotenv").config();
const amqp = require("amqplib");
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.URL_PROJ, process.env.API_KEY);

async function consume() {
  const exchange = "estoque.eventos";
  const queue = "fila.auditoria";

  try {
    const connection = await amqp.connect(process.env.AMQP);
    const channel = await connection.createChannel();

    await channel.assertExchange(exchange, "fanout", {
      durable: true,
    });

    await channel.assertQueue(queue, {
      durable: true,
    });

    await channel.bindQueue(queue, exchange, "");

    channel.prefetch(1);

    console.log(`[*] Aguardando mensagens na fila ${queue}...`);

    channel.consume(
      queue,
      async (msg) => {
        if (msg === null) return;

        try {
          const evento = JSON.parse(msg.content.toString());

          console.log("[V] Evento recebido:", evento);

          const movimentacao = {
            evento_id: evento.eventoId,
            produto_id: evento.produtoId,
            tipo: evento.tipo,
            quantidade: evento.quantidadeMovimentada,
            saldo_anterior: evento.saldoAnterior,
            saldo_atual: evento.saldoAtual,
            criado_em: evento.timestamp,
          };

          const { error } = await supabase
            .from("movimentacoes_estoque")
            .upsert(movimentacao, {
              onConflict: "evento_id",
              ignoreDuplicates: true,
            });

          if (error) {
            throw error;
          }

          console.log(
            `[V] Movimentação ${evento.eventoId} registrada ou já existente.`,
          );

          channel.ack(msg);
        } catch (error) {
          console.error("[X] Erro ao processar evento:", error.message);

          channel.nack(msg, false, true);
        }
      },
      { noAck: false },
    );
  } catch (error) {
    console.error("Erro no consumidor:", error.message);
  }
}

consume();
