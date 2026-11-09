const express = require('express');
const appUsuario = express();
const db = require('../banco/database');
const upload = require('../util/imagens');
const atualizacoes = require('../util/atualizacoes');

// ROTA PARA A PÁGINA DE DETALHES DOS PRODUTOS

appUsuario.get('/produtos/detalhe/:id', (req, res) => {
    db.get(
        'SELECT * FROM produtos WHERE id = ?',
        [req.params.id],
        function (erro, produto){
            if(erro){
                return res.send('Erro ao consultar produto.');
            }
            res.render('usuario/produtos_exibir/produtos_informacao', { produto });
        }
    )
});

//================== ROTAS DE CATEGORIAS ==================//
appUsuario.get('/categorias_lista', (req, res) => {
    db.all('SELECT * FROM categorias', [], (erro, categorias) => {
        if (erro) {
            console.log(erro.message);
            return res.send('Erro ao consultar categorias.');
        }
        res.render('usuario/produtos_exibir/categorias', { categorias });
    });
});

//================== ROTAS DE PRODUTOS ==================//

appUsuario.get('/produtos', (req, res) => {
    db.all(
        'SELECT * FROM produtos', 
        [], 
        function (erro, produtos) {
            if (erro) {
                console.log(erro.message);
                return res.send('Erro ao consultar produtos.');
            }
            res.render('usuario/produtos_exibir/produtos', { produtos });
        }
    );
});

appUsuario.get('/produtos/categoria/:id', (req, res) => {
    const categoriaId = req.params.id;

    db.get('SELECT * FROM categorias WHERE id = ?', [categoriaId], (err, categoria) => {
        if (err || !categoria) {
            console.log(err ? err.message : 'Categoria não encontrada');
            return res.status(404).send('Categoria não encontrada.');
        }

        db.all('SELECT * FROM produtos WHERE categoria = ?', [categoria.nome], (erro, produtos) => {
            if (erro) {
                console.log(erro.message);
                return res.send('Erro ao consultar produtos da categoria.');
            }
            
            res.render('usuario/produtos_exibir/produtos_categoria', { 
                produtos: produtos, 
                categoria: categoria 
            });
        });
    });
});

// ROTA PARA A PÁGINA SOBRE

appUsuario.get('/sobre', (req, res) => {
    res.render('usuario/componentes/sobre');
});

// ROTA PARA A PÁGINA CARRINHO

appUsuario.get('/carrinho', (req, res) => {
    res.redirect('/carrinho');
});

module.exports = appUsuario;