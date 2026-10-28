const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./banco/ecommerce.db', (erro) => {
    if (erro) {
        console.log(erro.message);
    } else {
        console.log('Banco conectado.');
    }
});

db.serialize(() => {
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

    // TABELA QUE REGISTRA OS PEDIDOS FEITOS PELOS USUÁRIOS/CLIENTES
    db.run(`
        CREATE TABLE IF NOT EXISTS pedido (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER,
            total FLOAT NOT NULL,
            data_pedido DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'Pendente',
            FOREIGN KEY (usuario_id) REFERENCES usuario(id)
        );
    `);

    // TABELA QUE REGISTRA OS ITENS DE CADA PEDIDO (Vínculo do pedido com os produtos e quantidade comprada)
    db.run(`
        CREATE TABLE IF NOT EXISTS itens_pedido (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_id INTEGER,
            produto_id INTEGER,
            quantidade INTEGER NOT NULL,
            valor_unitario FLOAT NOT NULL,
            FOREIGN KEY (pedido_id) REFERENCES pedido(id),
            FOREIGN KEY (produto_id) REFERENCES produtos(id)
        );
    `);

    // TABELAS RELACIONADAS A USUÁRIO/CLIENTE

    db.run(`
        CREATE TABLE IF NOT EXISTS usuario (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario TEXT NOT NULL,
            email TEXT NOT NULL,
            senha TEXT NOT NULL
        );
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS entrega (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            cep FLOAT NOT NULL,
            endereco TEXT NOT NULL,
            cidade TEXT NOT NULL,
            estado TEXT NOT NULL
        );
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS pagamento (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            forma TEXT NOT NULL
        );
    `);
    
    db.run(`
        CREATE TABLE IF NOT EXISTS carrinho (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            produto_id INTEGER,
            quantidade INTEGER,
            usuario_id INTEGER,
            FOREIGN KEY (produto_id) REFERENCES produtos(id),
            FOREIGN KEY (usuario_id) REFERENCES usuario(id)
        );
    `);

});

module.exports = db;