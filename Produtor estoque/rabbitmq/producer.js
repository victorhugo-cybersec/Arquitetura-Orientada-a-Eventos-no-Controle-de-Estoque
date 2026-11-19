require("dotenv").config();
const amqp = require("amqplib");

async function produce(evento) {
  const exchange = "estoque.eventos";

  let connection;
  let channel;

  try {
    if (!process.env.AMQP) {
      throw new Error("Variável AMQP não encontrada no .env");
    }

    connection = await amqp.connect(process.env.AMQP);
    channel = await connection.createConfirmChannel();

    await channel.assertExchange(exchange, "fanout", {
      durable: true,
    });

    const mensagem = Buffer.from(JSON.stringify(evento));

    channel.publish(exchange, "", mensagem, {
      persistent: true,
      mandatory: true,
    });

    // Confirma que o RabbitMQ recebeu a publicação
    await channel.waitForConfirms();

    console.log("[x] Evento publicado:", evento.eventoId);
  } catch (error) {
    console.error("[!] Erro ao publicar evento:", error.message);
    throw error;
  } finally {
    if (channel) await channel.close().catch(() => {});
    if (connection) await connection.close().catch(() => {});
  }
}

module.exports = produce;
