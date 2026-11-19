const express = require('express');
const controller = require('../controllers/estoqueControl')

const router = express.Router();

router.get('/', controller.hello);
router.get('/produtos', controller.getProdutos);
router.get('/produto/:id', controller.getProdutoByID);
router.post('/produtos', controller.produtoStore);
router.put('/produtos/:id', controller.update);
router.delete('/produtos/:id', controller.deletaProduto);
router.post("/produtos/:id/movimentar", controller.movimentarEstoque);

module.exports = router;