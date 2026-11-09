const express = require('express');
const appAdmin = express();
const db = require('../banco/database');
const upload = require('../util/imagens');
const atualizacoes = require('../util/atualizacoes');

// ================== CRIAÇÃO AUTOMÁTICA DO ADMIN (SEED) ================== //
const emailPadrao = "admin@relicario.com";
const senhaPadrao = "123456";

db.get('SELECT * FROM login WHERE email = ?', [emailPadrao], (err, usuario) => {
    if (!err && !usuario) {
        db.run(
            'INSERT INTO login (nome, email, senha) VALUES (?, ?, ?)',
            ['Administrador', emailPadrao, senhaPadrao],
            (err) => {
                if (err) console.log('Erro ao criar admin automático:', err.message);
                else console.log('✅ Admin padrão pronto para uso: admin@relicario.com / 123456');
            }
        );
    }
});


//================== ROTAS DE LOGIN/INDEX ==================//
appAdmin.get('/index', (req, res) => {
    res.render('admin/index-admin');
});

appAdmin.get('/', (req, res) => {
    res.render('admin/login');
});

appAdmin.post('/login', (req, res) => {
    const email = req.body.email;
    const senha = req.body.senha;

    const sql = 'SELECT * FROM login WHERE email = ? AND senha = ?';

    db.get(sql, [email, senha], (err, usuario) => {
        if (err) {
            console.log(err.message);
            return res.render('admin/login', { erro: 'Erro interno na base de dados.' });
        }

        if (usuario) {
            return res.redirect('/admin/index');
        } else {
            return res.render('admin/login', { erro: 'E-mail ou senha incorretos!' });
        }
    });
});

appAdmin.get('/login/listar', (req, res) => {
    db.all('SELECT * FROM login', [], function (erro, usuarios) {
        if (erro) {
            console.log(erro.message);
            return res.send('Erro ao consultar logins.');
        }
        res.render('admin/login/lista', { logins: usuarios });
    });
});

appAdmin.get('/login/cadastro', (req, res) => {
    res.render('admin/login/cadastro', { login: null });
});

appAdmin.get('/login/editar/:id', (req, res) => {
    db.get('SELECT * FROM login WHERE id = ?', [req.params.id], (erro, login) => {
        if (erro) {
            console.log(erro.message);
            return res.send('Erro ao consultar login.');
        }
        if (!login) {
            return res.status(404).send('Login não encontrado.');
        }
        res.render('admin/login/cadastro', { login });
    });
});

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

appAdmin.post('/login/atualizar/:id', (req, res) => {
    const { nome, email, senha } = req.body;

    db.run(
        'UPDATE login SET nome = ?, email = ?, senha = ? WHERE id = ?',
        [nome, email, senha, req.params.id],
        function (erro) {
            if (erro) {
                console.log(erro.message);
                return res.send('Erro ao atualizar login.');
            }
            if (this.changes === 0) {
                return res.status(404).send('Login não encontrado.');
            }
            res.redirect('/admin/login/listar');
        }
    );
});

appAdmin.get('/login/excluir/:id', (req, res) => {
    const id = req.params.id;

    db.run(
        `DELETE FROM login WHERE id = ?`,
        [id],
        function (erro) {
            if (erro) {
                console.log(erro.message);
                return res.send('Erro ao excluir login.');
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
    res.render('admin/categorias/cadastro', { categoria: null });
});

appAdmin.get('/categorias/editar/:id', (req, res) => {
    db.get('SELECT * FROM categorias WHERE id = ?', [req.params.id], (erro, categoria) => {
        if (erro) {
            console.log(erro.message);
            return res.send('Erro ao consultar categoria.');
        }
        if (!categoria) {
            return res.status(404).send('Categoria não encontrada.');
        }
        res.render('admin/categorias/cadastro', { categoria });
    });
});

// Cadastro de categoria com o middleware de upload
appAdmin.post('/categorias/cadastrar', upload.single('imagem'), (req, res) => {
    const nome = req.body.nome;
    const imagem = req.file ? req.file.filename : null;
    const descricao = req.body.descricao;

    db.run(
        `INSERT INTO categorias (nome, imagem, descricao) VALUES (?, ?, ?)`,
        [nome, imagem, descricao],
        function (erro) {
            if (erro) {
                console.log(erro.message);
                return res.send('Erro ao cadastrar categoria.');
            }
            res.redirect('/admin/categorias');
        }
    );
});

// Atualização de categoria com suporte a imagem
appAdmin.post('/categorias/atualizar/:id', upload.single('imagem'), (req, res) => {
    const { nome, descricao } = req.body;
    const imagem = req.file ? req.file.filename : null;

    db.serialize(() => {
        db.run('BEGIN TRANSACTION', (erro) => {
            if (erro) {
                console.log(erro.message);
                return res.send('Erro ao iniciar atualização da categoria.');
            }

            db.get('SELECT nome FROM categorias WHERE id = ?', [req.params.id], (erroCategoria, categoria) => {
                if (erroCategoria || !categoria) {
                    return db.run('ROLLBACK', () => {
                        if (erroCategoria) return res.send('Erro ao consultar categoria.');
                        res.status(404).send('Categoria não encontrada.');
                    });
                }

                const queryUpdateCat = imagem 
                    ? 'UPDATE categorias SET nome = ?, imagem = ?, descricao = ? WHERE id = ?'
                    : 'UPDATE categorias SET nome = ?, descricao = ? WHERE id = ?';
                
                const paramsUpdateCat = imagem 
                    ? [nome, imagem, descricao, req.params.id]
                    : [nome, descricao, req.params.id];

                db.run(queryUpdateCat, paramsUpdateCat, (erroAtualizacao) => {
                    if (erroAtualizacao) {
                        console.log(erroAtualizacao.message);
                        return db.run('ROLLBACK', () => res.send('Erro ao atualizar categoria.'));
                    }

                    db.run(
                        'UPDATE produtos SET categoria = ? WHERE categoria = ?',
                        [nome, categoria.nome],
                        (erroProdutos) => {
                            if (erroProdutos) {
                                console.log(erroProdutos.message);
                                return db.run('ROLLBACK', () => res.send('Erro ao atualizar produtos da categoria.'));
                            }

                            db.run('COMMIT', (erroCommit) => {
                                if (erroCommit) {
                                    console.log(erroCommit.message);
                                    return db.run('ROLLBACK', () => res.send('Erro ao salvar categoria.'));
                                }
                                res.redirect('/admin/categorias');
                            });
                        }
                    );
                });
            });
        });
    });
});

appAdmin.get('/categorias/excluir/:id', (req, res) => {
    const id = req.params.id;

    db.run(
        `DELETE FROM categorias WHERE id = ?`,
        [id],
        function (erro) {
            if (erro) {
                console.log(erro.message);
                return res.send('Erro ao excluir categoria.');
            }
            res.redirect('/admin/categorias');
        }
    );
});

//================== ROTAS DE PRODUTOS ==================//

appAdmin.get('/produtos', (req, res) => {
    db.all(
        'SELECT * FROM produtos', 
        [], 
        function (erro, produtos) {
            if (erro) {
                console.log(erro.message);
                return res.send('Erro ao consultar produtos.');
            }
            res.render('admin/produtos/lista', { produtos });
        }
    );
});

appAdmin.get('/produtos/editar/:id', (req, res) => {
    db.get('SELECT * FROM produtos WHERE id = ?', [req.params.id], (erro, produto) => {
        if (erro) {
            console.log(erro.message);
            return res.send('Erro ao consultar produto.');
        }
        if (!produto) {
            return res.status(404).send('Produto não encontrado.');
        }

        db.all('SELECT * FROM categorias', [], (erroCategorias, categorias) => {
            if (erroCategorias) {
                console.log(erroCategorias.message);
                return res.send('Erro ao consultar categorias.');
            }
            res.render('admin/produtos/cadastro', { categorias, produto });
        });
    });
});

appAdmin.get('/produtos/form-cadastrar', (req, res) => {
    db.all(
        'SELECT * FROM categorias', 
        [], 
        function (erro, categorias) {
            if (erro) {
                console.log(erro.message);
                return res.send('Erro ao consultar categorias.');
            }
            res.render('admin/produtos/cadastro', { categorias, produto: null });
        }
    );
});

appAdmin.post('/produtos/cadastrar', upload.single('imagem'), (req, res) => {
    const nome = req.body.nome;
    const categoria = req.body.categoria;
    const valor = req.body.valor;
    const estoque = req.body.estoque;
    const imagem = req.file ? req.file.filename : null;
    const descricao = req.body.descricao;
    const fabricacao = req.body.fabricacao;
    const conservacao = req.body.conservacao;
    const material = req.body.material;
    const destaque = req.body.destaque ? 1 : 0;

    db.run(
        `INSERT INTO produtos (nome, categoria, valor, estoque, imagem, descricao, fabricacao, conservacao, material, destaque) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [nome, categoria, valor, estoque, imagem, descricao, fabricacao, conservacao, material, destaque],
        function (erro) {
            if (erro) {
                console.log(erro.message);
                return res.send('Erro ao cadastrar produtos.');
            }
            atualizacoes.emit('produtos-atualizados');
            res.redirect('/admin/produtos');
        }
    );
});

appAdmin.post('/produtos/atualizar/:id', upload.single('imagem'), (req, res) => {
    const { nome, categoria, valor, estoque, descricao, fabricacao, conservacao, material } = req.body;
    const imagem = req.file ? req.file.filename : null;
    const destaque = req.body.destaque ? 1 : 0;

    db.run(
        `UPDATE produtos
         SET nome = ?, categoria = ?, valor = ?, estoque = ?, imagem = COALESCE(?, imagem),
             descricao = ?, fabricacao = ?, conservacao = ?, material = ?, destaque = ?
         WHERE id = ?`,
        [nome, categoria, valor, estoque, imagem, descricao, fabricacao, conservacao, material, destaque, req.params.id],
        function (erro) {
            if (erro) {
                console.log(erro.message);
                return res.send('Erro ao atualizar produto.');
            }
            if (this.changes === 0) {
                return res.status(404).send('Produto não encontrado.');
            }
            atualizacoes.emit('produtos-atualizados');
            res.redirect('/admin/produtos');
        }
    );
});

appAdmin.get('/produtos/excluir/:id', (req, res) => {
    const id = req.params.id;

    db.run(
        `DELETE FROM produtos WHERE id = ?`,
        [id],
        function (erro) {
            if (erro) {
                console.log(erro.message);
                return res.send('Erro ao excluir produtos.');
            }
            atualizacoes.emit('produtos-atualizados');
            res.redirect('/admin/produtos');
        }
    );
});

module.exports = appAdmin;