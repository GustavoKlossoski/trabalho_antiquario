const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'ecommerce.db');
const bkpPath = path.resolve(__dirname, 'ecommerce.db.bkp');

const db = new sqlite3.Database(dbPath, (erro) => {
    if (erro) {
        console.log('Erro ao conectar no banco:', erro.message);
    } else {
        console.log('Banco conectado.');
    }
});

function migrarUsuarios(callback) {
    db.all('PRAGMA table_info(usuarios)', (erro, colunas) => {
        if (erro) {
            return callback(erro);
        }

        if (!colunas.some(coluna => coluna.name === 'cpf')) {
            return callback(null);
        }

        db.run('BEGIN TRANSACTION', (erroTransacao) => {
            if (erroTransacao) {
                return callback(erroTransacao);
            }

            function falhar(erroMigracao) {
                db.run('ROLLBACK', () => callback(erroMigracao));
            }

            db.run(`
                CREATE TABLE usuarios_nova (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nome TEXT NOT NULL,
                    email TEXT NOT NULL UNIQUE,
                    senha TEXT NOT NULL
                )
            `, (erroCriacao) => {
                if (erroCriacao) {
                    return falhar(erroCriacao);
                }

                db.run(`
                    INSERT INTO usuarios_nova (id, nome, email, senha)
                    SELECT id, nome, email, senha FROM usuarios
                `, (erroCopia) => {
                    if (erroCopia) {
                        return falhar(erroCopia);
                    }

                    db.run('DROP TABLE usuarios', (erroRemocao) => {
                        if (erroRemocao) {
                            return falhar(erroRemocao);
                        }

                        db.run('ALTER TABLE usuarios_nova RENAME TO usuarios', (erroRenomeacao) => {
                            if (erroRenomeacao) {
                                return falhar(erroRenomeacao);
                            }

                            db.run('COMMIT', callback);
                        });
                    });
                });
            });
        });
    });
}

db.serialize(() => {
    // 1. Cria todas as tabelas necessárias no banco novo
    db.run(`
        CREATE TABLE IF NOT EXISTS categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            imagem TEXT NOT NULL,
            descricao TEXT
        );
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS produtos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            categoria TEXT,
            valor FLOAT,
            estoque INTEGER DEFAULT 0,
            descricao TEXT,
            imagem TEXT NOT NULL,
            fabricacao TEXT NOT NULL,
            conservacao TEXT NOT NULL,
            material TEXT NOT NULL,
            destaque INTEGER DEFAULT 0
        );
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS login (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT NOT NULL,
            senha TEXT NOT NULL
        );
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            senha TEXT NOT NULL
        );
    `, (erroUsuarios) => {
        if (erroUsuarios) {
            console.error('Erro ao criar tabela usuarios:', erroUsuarios.message);
            return;
        }

        migrarUsuarios((erroMigracao) => {
            if (erroMigracao) {
                console.error('Erro ao atualizar tabela usuarios:', erroMigracao.message);
                return;
            }

            // 2. Verifica se o banco principal está sem produtos para iniciar a importação
            db.get(`SELECT COUNT(*) as total FROM produtos`, (err, row) => {
                if (err) return;

                if (row.total === 0) {
                    console.log('Banco vazio. Importando dados do backup...');

                    db.run(`ATTACH DATABASE ? AS antigo`, [bkpPath], (attachErr) => {
                        if (attachErr) {
                            console.log('Erro ao anexar backup:', attachErr.message);
                            return;
                        }

                        // Migra os Produtos
                        db.run(`
                            INSERT OR IGNORE INTO produtos (id, nome, categoria, valor, estoque, descricao, imagem, fabricacao, conservacao, material, destaque)
                            SELECT id, nome, categoria, valor, estoque, descricao, imagem, fabricacao, conservacao, material, destaque 
                            FROM antigo.produtos;
                        `, function(prodErr) {
                            if (!prodErr) {
                                console.log(`Sucesso! ${this.changes} produtos recuperados.`);
                            }
                        });

                        // Migra as Categorias (caso existam no backup)
                        db.run(`
                            INSERT OR IGNORE INTO categorias (id, nome, imagem, descricao)
                            SELECT id, nome, imagem, descricao 
                            FROM antigo.categorias;
                        `, function(catErr) {
                            if (!catErr && this.changes > 0) {
                                console.log(`Sucesso! ${this.changes} categorias recuperadas.`);
                            }
                        });

                        // Migra os Logins (caso existam no backup)
                        db.run(`
                            INSERT OR IGNORE INTO login (id, nome, email, senha)
                            SELECT id, nome, email, senha 
                            FROM antigo.login;
                        `, function(logErr) {
                            if (!logErr && this.changes > 0) {
                                console.log(`Sucesso! ${this.changes} registros de login recuperados.`);
                            }

                            // Desanexa o banco antigo após finalizar todas as inserções
                            db.run(`DETACH DATABASE antigo;`, () => {
                                console.log('Processo de importação finalizado.');
                            });
                        });
                    });
                }
            });
        });
    });
});

module.exports = db;