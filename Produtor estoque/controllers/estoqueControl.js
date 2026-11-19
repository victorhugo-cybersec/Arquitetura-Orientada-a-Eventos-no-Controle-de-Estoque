const supabase = require("../config/database");
const produce = require("../rabbitmq/producer");

const hello = (req, res) => {
  res.send("Hello World 3!");
};

const getProdutos = async (req, res) => {
  try {
    const { data, error } = await supabase.from("produtos").select("*");

    if (error) return res.status(401).json({ mensagem: error.message });
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensagem: error.message });
  }
};

const getProdutoByID = async (req, res) => {
  try {
    let id = req.params.id;
    const { data, error } = await supabase
      .from("produtos")
      .select("*")
      .eq("id", id);

    if (error) return res.status(401).json({ mensagem: error.message });
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensagem: error.message });
  }
};

const produtoStore = async (req, res) => {
  const { nome, preco, estoque } = req.body;

  try {
    const { data, error } = await supabase
      .from("produtos")
      .insert([{ nome, preco, estoque }])
      .select();

    if (error) res.status(400).json({ mensagem: error.message });

    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ mensagem: error.message });
  }
};

const update = async (req, res) => {
  const { id } = req.params;
  const { nome, preco, estoque } = req.body;

  if (!nome && preco == null && estoque == null) {
    return res
      .status(400)
      .json({
        error:
          "Informe ao menos um campo para atualizar (nome, preço, estoque)",
      });
  }

  try {
    const { data, error } = await supabase
      .from("produtos")
      .update({ nome, preco, estoque })
      .eq("id", id)
      .select();

    if (error) return res.status(400).json({ error: error.message });

    if (!data || data.length === 0) {
      return res
        .status(404)
        .json({ error: "Produto não encontrado para atualização." });
    }

    return res.json({
      mensagem: "Produto atualizado com sucesso.",
      produto: data[0],
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const deletaProduto = async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from("produtos")
      .delete()
      .eq("id", id)
      .select();

    if (error) return res.status(400).json({ error: error.message });

    if (!data || data.length === 0) {
      return res
        .status(400)
        .json({ error: "Produto não encontrado para deleção." });
    }

    return res.json({ mensagem: "Produto apagado com sucesso." });
  } catch (erro) {
    return res.status(500).json({ erro: erro.message });
  }
};


const movimentarEstoque = async (req, res) => {
  const { id } = req.params;
  const { tipo, quantidade } = req.body;

  try {
    if (
      !["ENTRADA", "SAIDA"].includes(tipo) ||
      !Number.isInteger(quantidade) ||
      quantidade <= 0
    ) {
      return res.status(400).json({
        mensagem: "Tipo ou quantidade inválida.",
      });
    }

    const { data: produto, error: erroBusca } = await supabase
      .from("produtos")
      .select("*")
      .eq("id", id)
      .single();

    if (erroBusca || !produto) {
      return res.status(404).json({
        mensagem: "Produto não encontrado.",
      });
    }

    const saldoAnterior = produto.estoque;

    let saldoAtual;

    if (tipo === "SAIDA") {
      if (saldoAnterior < quantidade) {
        return res.status(400).json({
          mensagem: "Estoque insuficiente.",
        });
      }

      saldoAtual = saldoAnterior - quantidade;
    } else {
      saldoAtual = saldoAnterior + quantidade;
    }

    const { data: produtoAtualizado, error: erroUpdate } = await supabase
      .from("produtos")
      .update({ estoque: saldoAtual })
      .eq("id", id)
      .select()
      .single();

    if (erroUpdate) {
      return res.status(400).json({
        mensagem: erroUpdate.message,
      });
    }

    const evento = {
      eventoId: crypto.randomUUID(),
      produtoId: produto.id,
      nomeProduto: produto.nome,
      tipo: tipo,
      quantidadeMovimentada: quantidade,
      saldoAnterior: saldoAnterior,
      saldoAtual: saldoAtual,
      estoqueMinimo: produto.estoque_minimo,
      timestamp: new Date().toISOString(),
    };

    console.log("[CONTROLLER] Enviando evento para o RabbitMQ...");

    await produce(evento);

    console.log("[CONTROLLER] Publicação concluída!");

    return res.status(200).json({
      mensagem: "Estoque movimentado com sucesso!",
      produto: produtoAtualizado,
      evento: evento,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      mensagem: error.message,
    });
  }
};


module.exports = {
  hello,
  getProdutos,
  getProdutoByID,
  produtoStore,
  update,
  deletaProduto,
  movimentarEstoque
};
