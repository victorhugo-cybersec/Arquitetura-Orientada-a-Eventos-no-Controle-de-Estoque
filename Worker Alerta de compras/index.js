require("dotenv").config();

const amqp = require("amqplib");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.URL_PROJ, process.env.API_KEY);

async function consume() {
  const exchange = "estoque.eventos";
  const queue = "fila.compras";

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

        let evento;

        // 1. Receber e interpretar o evento
        try {
          evento = JSON.parse(msg.content.toString());

          console.log("[V] Evento recebido:", evento);
        } catch (error) {
          console.error("[X] Mensagem JSON inválida:", error.message);

          channel.nack(msg, false, false);
          return;
        }

        try {
          // 2. Verificar se o estoque está crítico
          if (evento.saldoAtual <= evento.estoqueMinimo) {
            // Criar alerta de reposição
            const alerta = {
              produto_id: evento.produtoId,
              saldo_atual: evento.saldoAtual,
              estoque_minimo: evento.estoqueMinimo,
              status: "PENDENTE",
              criado_em: new Date().toISOString(),
            };

            const { data, error } = await supabase
              .from("alertas_reposicao")
              .insert([alerta])
              .select();

            if (error) throw error;

            console.log("[!] ALERTA DE REPOSIÇÃO CRIADO!");

            // Simular notificação para o setor de compras
            console.log(
              JSON.stringify(
                {
                  nivel: "ALERTA",
                  evento: "ESTOQUE_CRITICO",
                  mensagem: "Produto precisa de reposição!",
                  produtoId: evento.produtoId,
                  nomeProduto: evento.nomeProduto,
                  saldoAtual: evento.saldoAtual,
                  estoqueMinimo: evento.estoqueMinimo,
                  status: "PENDENTE",
                },
                null,
                2,
              ),
            );

            console.log("[V] Alerta registrado no Supabase:", data);
          }

          // 3. Verificar se o estoque foi recuperado
          else if (
            evento.tipo === "ENTRADA" &&
            evento.saldoAtual > evento.estoqueMinimo
          ) {
            const { data, error } = await supabase
              .from("alertas_reposicao")
              .update({ status: "RESOLVIDO" })
              .eq("produto_id", evento.produtoId)
              .eq("status", "PENDENTE")
              .select();

            if (error) throw error;

            console.log("[V] Alertas de reposição resolvidos!");
            console.log("[V] Registros atualizados:", data);
          }

          // 4. Nenhuma ação necessária
          else {
            console.log(
              `[i] Estoque normal. Produto ${evento.produtoId}: ${evento.saldoAtual} unidades.`,
            );
          }

          // 5. Confirmar processamento
          channel.ack(msg);
        } catch (error) {
          console.error("[X] Erro ao processar alerta:", error.message);

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
