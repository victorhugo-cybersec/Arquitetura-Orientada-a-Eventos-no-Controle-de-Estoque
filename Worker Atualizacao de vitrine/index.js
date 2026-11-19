require("dotenv").config();

const amqp = require("amqplib");
const { createClient } = require("@supabase/supabase-js");

// Conexão com o Supabase
const supabase = createClient(process.env.URL_PROJ, process.env.API_KEY);

async function consume() {
  const exchange = "estoque.eventos";
  const queue = "fila.vitrine";

  try {
    // Conecta ao RabbitMQ
    const connection = await amqp.connect(process.env.AMQP);
    const channel = await connection.createChannel();

    // Declara a Exchange
    await channel.assertExchange(exchange, "fanout", {
      durable: true,
    });

    // Declara a fila da Vitrine
    await channel.assertQueue(queue, {
      durable: true,
    });

    // Vincula a fila à Exchange
    await channel.bindQueue(queue, exchange, "");

    // Processa uma mensagem por vez
    channel.prefetch(1);

    console.log(`[*] Aguardando mensagens na fila ${queue}...`);

    channel.consume(
      queue,
      async (msg) => {
        if (msg === null) return;

        try {
          // 1. Recebe o evento
          const evento = JSON.parse(msg.content.toString());

          console.log("[V] Evento recebido:", evento);

          let disponivel;

          // 2. Verifica as condições de disponibilidade
          if (evento.saldoAtual === 0) {
            disponivel = false;
          } else if (evento.tipo === "ENTRADA" && evento.saldoAtual > 0) {
            disponivel = true;
          } else {
            // Nenhuma atualização necessária
            console.log(
              `[i] Disponibilidade mantida para o produto ${evento.produtoId}.`,
            );

            channel.ack(msg);
            return;
          }

          // 3. Atualiza a disponibilidade no Supabase
          const { data, error } = await supabase
            .from("produtos")
            .update({ disponivel })
            .eq("id", evento.produtoId)
            .select("id, nome, estoque, disponivel")
            .single();

          if (error) {
            throw error;
          }

          // 4. Exibe o resultado
          console.log(`[V] Vitrine atualizada: ${data.nome}`);

          console.log(
            `[V] Produto ${disponivel ? "DISPONÍVEL" : "INDISPONÍVEL"}`,
          );

          // 5. Confirma o processamento
          channel.ack(msg);
        } catch (error) {
          console.error("[X] Erro ao atualizar vitrine:", error.message);

          // Tenta processar novamente
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
