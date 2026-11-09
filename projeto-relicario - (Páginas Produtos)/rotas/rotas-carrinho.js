const express = require('express');
const appCarrinho = express();
const db = require('../banco/database');

// O carrinho na sessão é uma lista de itens: [{ id: 3, quantidade: 2 }, ...]
function obterCarrinho(req) {
    if (!req.session.carrinho) {
        req.session.carrinho = [];
    }
    return req.session.carrinho;
}

// Busca no banco os produtos cujos ids estão no carrinho
function buscarProdutos(ids, callback) {
    if (ids.length === 0) {
        return callback(null, []);
    }
    const marcadores = ids.map(() => '?').join(', ');
    db.all(
        `SELECT * FROM produtos WHERE id IN (${marcadores})`,
        ids,
        callback
    );
}

//================= VER CARRINHO =====================
appCarrinho.get('/', (req, res) => {
    const carrinho = obterCarrinho(req);
    const ids = carrinho.map(item => item.id);

    buscarProdutos(ids, function (erro, produtosBanco) {
        if (erro) {
            console.log(erro.message);
            return res.status(500).send('Erro ao consultar o carrinho.');
        }

        db.all(
            'SELECT * FROM categorias',
            [],
            function (erro, categorias) {
                if (erro) {
                    console.log(erro.message);
                    return res.status(500).send('Erro ao consultar categorias.');
                }         

                // Junta cada produto com a sua quantidade e calcula o valor parcial
                const itens = [];
                carrinho.forEach(function (item) {
                    const produto = produtosBanco.find(p => p.id === item.id);
                    if (produto) {
                        itens.push({
                            produto: produto,
                            quantidade: item.quantidade,
                            subtotal: produto.valor * item.quantidade
                        });
                    }
                });

                const totalItens = itens.reduce((soma, item) => soma + item.quantidade, 0);
                const subtotal = itens.reduce((soma, item) => soma + item.subtotal, 0);
                //const frete = totalItens === 0 ? 0 : 10; // frete fixo (R$ 10,00)
                const frete = totalItens === 0 ? 0 : totalItens * 10; // frete por item (R$ 10,00 por item)
                const total = subtotal + frete;

                res.render('usuario/compra/carrinho', { itens, subtotal, frete, total, totalItens, categorias });
            }
        );
    });
});

//================= ADICIONAR (ou aumentar quantidade) =====================
appCarrinho.post('/adicionar/:id', (req, res) => {
    const id = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(id) || id <= 0) {
        return res.redirect('/carrinho');
    }

    db.get(
        'SELECT * FROM produtos WHERE id = ?',
        [id],
        function (erro, produto) {
            if (erro) {
                console.log(erro.message);
                return res.status(500).send('Erro ao adicionar ao carrinho.');
            }

            if (!produto) {
                return res.status(404).send('Produto não encontrado.');
            }
           
            const carrinho = obterCarrinho(req);
            const item = carrinho.find(i => i.id === id);

            if (item) {
  
                if (item.quantidade < produto.estoque) { // Limite de estoque
                    item.quantidade += 1;
                }
            } else {
                carrinho.push({ id: id, quantidade: 1 });
            }

            res.redirect('/carrinho');
        }
    );
});

//================= DIMINUIR QUANTIDADE =====================
appCarrinho.post('/diminuir/:id', (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    const carrinho = obterCarrinho(req);
    const item = carrinho.find(i => i.id === id);

    if (item) {
        item.quantidade -= 1;
        if (item.quantidade <= 0) {
            req.session.carrinho = carrinho.filter(i => i.id !== id);
        }
    }

    res.redirect('/carrinho');
});

//================= REMOVER =====================
appCarrinho.post('/remover/:id', (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    req.session.carrinho = obterCarrinho(req).filter(i => i.id !== id);
    res.redirect('/carrinho');
});

//================= ESVAZIAR =====================
appCarrinho.post('/limpar', (req, res) => {
    req.session.carrinho = [];
    res.redirect('/carrinho');
});

module.exports = appCarrinho;