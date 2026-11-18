const express = require('express');
const bcrypt = require('bcryptjs');
const appUsuario = express();
const db = require('../banco/database');
const { exigirLogin } = require('../util/autenticacao');
const finalizarCompra = require('../util/finalizar-compra');

const FORMAS_PAGAMENTO = ['pix', 'credito', 'debito', 'boleto'];

// Monta o menu (categorias) usado pelo topo do site
function carregarMenu(res, callback) {
    db.all('SELECT * FROM categorias', [], function (erro, categorias) {
        if (erro) {
            console.log(erro.message);
            return res.status(500).send('Erro ao consultar categorias.');
        }
        callback(categorias);
    });
}

//================= CADASTRO =====================

appUsuario.get('/cadastro', (req, res) => {
    carregarMenu(res, (categorías) => {
        res.render('usuario/login/cadastro', {
            categorías,
            titulo: 'Criar conta',
            erro: null,
            valores: {}
        });
    });
});

appUsuario.post('/cadastro', (req, res) => {
    const nome = (req.body.nome || '').trim();
    const email = (req.body.email || '').trim().toLowerCase();
    const senha = req.body.senha || '';

    function mostrarErro(mensagem) {
        carregarMenu(res, (categorías) => {
            res.render('usuario/login/cadastro', {
                categorías,
                titulo: 'Criar conta',
                erro: mensagem,
                valores: { nome, email }
            });
        });
    }

    if (!nome || !email || !senha) {
        return mostrarErro('Preencha todos os campos.');
    }

    if (senha.length < 6) {
        return mostrarErro('A senha deve ter pelo menos 6 caracteres.');
    }

    const senhaHash = bcrypt.hashSync(senha, 10);

    db.run(
        'INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)',
        [nome, email, senhaHash],
        function (erro) {
            if (erro) {
                console.log(erro.message);
                if (erro.message.includes('usuarios.email')) {
                    return mostrarErro('Este e-mail já está cadastrado.');
                }
                return mostrarErro('Erro ao cadastrar usuário.');
            }
            res.redirect('/usuario/login?cadastro=ok');
        }
    );
});

//================= LOGIN / LOGOUT =====================

appUsuario.get('/login', (req, res) => {
    carregarMenu(res, (categorías) => {
        res.render('usuario/login/login', {
            categorías,
            titulo: 'Entrar',
            erro: null,
            sucesso: req.query.cadastro === 'ok',
            email: ''
        });
    });
});

appUsuario.post('/login', (req, res) => {
    const email = (req.body.email || '').trim().toLowerCase();
    const senha = req.body.senha || '';

    function mostrarErro(mensagem) {
        carregarMenu(res, (categorías) => {
            res.render('usuario/login/login', {
                categorías,
                titulo: 'Entrar',
                erro: mensagem,
                sucesso: false,
                email
            });
        });
    }

    db.get(
        'SELECT * FROM usuarios WHERE email = ?',
        [email],
        function (erro, usuario) {
            if (erro) {
                console.log(erro.message);
                return mostrarErro('Erro ao consultar usuário.');
            }
            if (!usuario || !bcrypt.compareSync(senha, usuario.senha)) {
                return mostrarErro('E-mail ou senha inválidos.');
            }

            // Nova sessão após o login (mantém o carrinho)
            // const carrinho = req.session.carrinho;
            // req.session.regenerate(function () {
            //     req.session.carrinho = carrinho;
            //     req.session.usuario = { id: usuario.id, nome: usuario.nome };
            //     res.redirect('/usuario/compra/confirmacao');
            // });
            const { cookie, ...dadosSessao } = req.session;
            req.session.regenerate(function () {
                Object.assign(req.session, dadosSessao);
                req.session.usuario = { id: usuario.id, nome: usuario.nome };
                req.session.save(function () {
                    res.redirect('/usuario/compra/confirmacao');
                });
            });
        }
    );
});

appUsuario.get('/logout', (req, res) => {
    req.session.destroy(function () {
        res.redirect('/');
    });
});

//================= CONFIRMAÇÃO DA COMPRA =====================

appUsuario.get('/compra/confirmacao', exigirLogin, (req, res) => {
    db.get(
        'SELECT id, nome, email FROM usuarios WHERE id = ?',
        [req.session.usuario.id],
        function (erro, usuario) {
            if (erro || !usuario) {
                console.log(erro ? erro.message : 'Usuário não encontrado.');
                return res.redirect('/usuario/login');
            }

            const carrinho = req.session.carrinho || [];
            const ids = carrinho.map(item => item.id);

            function renderizarConfirmacao(produtosBanco) {
                const produtosCarrinho = carrinho.reduce((produtos, item) => {
                    const produto = produtosBanco.find(p => p.id === item.id);
                    if (produto) {
                        produtos.push({ ...produto, quantidade: item.quantidade });
                    }
                    return produtos;
                }, []);

                const totalItens = produtosCarrinho.reduce((soma, item) => soma + item.quantidade, 0);
                const subtotal = produtosCarrinho.reduce((soma, item) => soma + item.valor * item.quantidade, 0);
                const frete = totalItens === 0 ? 0 : 10;
                const total = subtotal + frete;

                carregarMenu(res, (categorias) => {
                    res.render('usuario/compra/confirmacao', {
                        categorias,
                        titulo: 'Confirmação da compra',
                        usuario,
                        produtosCarrinho,
                        total
                    });
                });
            }

            if (ids.length === 0) {
                return renderizarConfirmacao([]);
            }

            const marcadores = ids.map(() => '?').join(', ');
            db.all(
                `SELECT * FROM produtos WHERE id IN (${marcadores})`,
                ids,
                function (erroProdutos, produtosBanco) {
                    if (erroProdutos) {
                        console.log(erroProdutos.message);
                        return res.status(500).send('Erro ao consultar os itens da compra.');
                    }
                    renderizarConfirmacao(produtosBanco);
                }
            );
        }
    );
});

appUsuario.post('/compra/finalizar', exigirLogin, (req, res) => {
    const carrinho = req.session.carrinho || [];

    finalizarCompra(carrinho).then(() => {
        req.session.carrinho = [];
        req.session.save((erro) => {
            if (erro) {
                console.error(erro.message);
                return res.status(500).send('Compra concluída, mas não foi possível salvar a sessão.');
            }

            carregarMenu(res, (categorias) => {
                res.render('usuario/compra/finalizacao', {
                    categorias,
                    titulo: 'Compra finalizada',
                    usuario: req.session.usuario
                });
            });
        });
    }).catch(erro => {
        console.error(erro.message);
        if (erro.code === 'ESTOQUE_INSUFICIENTE') {
            return res.status(409).send(erro.message);
        }
        if (erro.message === 'O carrinho está vazio.') {
            return res.redirect('/carrinho');
        }
        res.status(500).send('Erro ao finalizar a compra.');
    });
});

module.exports = appUsuario;
