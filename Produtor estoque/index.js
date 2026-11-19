const express = require('express');
const supabase = require('./config/database');
const rotasEstoque = require('./rotas/rotasEstoque');

const app = express();
app.use(express.json());
app.use(rotasEstoque);

const porta = process.env.PORTA;

app.listen(porta, ()=>{
    console.log('servidor em execucao no host: http://localhost:3000')
});