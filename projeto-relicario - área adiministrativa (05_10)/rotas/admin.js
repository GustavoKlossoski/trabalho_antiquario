const express = require('express');
const appAdmin = express();
const db = require('../banco/database');
const upload = require('../util/imagens');


//================== ROTAS DE LOGIN/INDEX ==================//
appAdmin.get('/index', (req, res) => {
    res.render('admin/index-admin');
});

appAdmin.get('/', (req, res) => {
    res.render('admin/login');
});

appAdmin.post('/login', (req, res) => {
    // algoritmo de autenticação do usuário - FUTURO
    res.redirect('/admin/index');
});

// Rota de listar logins
appAdmin.get('/login/listar', (req, res) => {
    db.all('SELECT * FROM login', [], function (erro, usuarios) {
        if (erro) {
            console.log(erro.message);
            return res.send('Erro ao consultar logins.');
        }
        res.render('admin/login/lista', { logins: usuarios });
    });
});

// Ajustada a rota para corresponder às URLs utilizadas nos botões (/login/cadastro)
appAdmin.get('/login/cadastro', (req, res) => {
    res.render('admin/login/cadastro');
});

// Rota de processamento do cadastro
appAdmin.post('/login/cadastrar', (req, res) => {
    const nome = req.body.nome;
    const email = req.body.email;
    const senha = req.body.senha;

    db.run(
        `INSERT INTO login (nome, email, senha) VALUES (?, ?, ?)`,
        [nome, email, senha],
        function (erro) {
            if (erro) {
                console.log(erro.message);
                return res.send('Erro ao cadastrar login.');
            }
            res.redirect('/admin/login/listar');
        }
    );
});


//================== ROTAS DE CATEGORIAS ==================//
appAdmin.get('/categorias', (req, res) => {
    db.all(
        'SELECT * FROM categorias', 
        [], 
        function (erro, categorias) {
            if (erro) {
                console.log(erro.message);
                return res.send('Erro ao consultar categorias.');
            }
            res.render('admin/categorias/lista', { categorias });
        }
    );
});

appAdmin.get('/categorias/form-cadastrar', (req, res) => {
    res.render('admin/categorias/cadastro');
});

appAdmin.post('/categorias/cadastrar', (req, res) => {
    const nome = req.body.nome;
    const descricao = req.body.descricao;

    db.run(
        `INSERT INTO categorias (nome, descricao) VALUES (?, ?)`,
        [nome, descricao],
        function (erro) {
            if (erro) {
                console.log(erro.message);
                return res.send('Erro ao cadastrar categoria.');
            }
            res.redirect('/admin/categorias');
        }
    );
});

//================== ROTAS DE PRODUTOS ==================//


//ROTA PARA CONSULTAR TODOS OS PRODUTOS
appAdmin.get('/produtos', (req, res) => {
    db.all(
        'SELECT * FROM produtos', 
        [], 
        function (erro, produtos) {
            if (erro) {
                console.log(erro.message);
                return res.send('Erro ao consultar categorias.');
            }
            res.render('admin/produtos/lista', {produtos});
        }
    );
});

//ROTA PARA EXIBIR O FORMULÁRIO DE CADASTRO DE PRODUTOS
//Precisa consultar as categorias para popular o select do formulário
appAdmin.get('/produtos/form-cadastrar', (req, res) => {
    db.all(
        'SELECT * FROM categorias', 
        [], 
        function (erro, categorias) {
            if (erro) {
                console.log(erro.message);
                return res.send('Erro ao consultar categorias.');
            }
            res.render('admin/produtos/cadastro', {categorias});
        }

    );
});

appAdmin.post('/produtos/cadastrar', upload.single('imagem'), (req, res) => {

    const nome = req.body.nome;
    const categoria = req.body.categoria;
    const valor = req.body.valor;
    const estoque = req.body.estoque;
    const imagem = req.file.filename; // Obtém o nome do arquivo enviado
    const descricao = req.body.descricao;
    const fabricacao = req.body.fabricacao;
    const conservacao = req.body.conservacao;
    const material = req.body.material;

    db.run(
        `INSERT INTO produtos (nome, categoria, valor, estoque, imagem, descricao, fabricacao, conservacao, material) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [nome, categoria, valor, estoque, imagem, descricao, fabricacao, conservacao, material],
        function (erro) {
            if (erro) {
                console.log(erro.message);
                return res.send('Erro ao cadastrar produtos.');
            }
            res.redirect('/admin/produtos');
        }
    );
});

module.exports = appAdmin;