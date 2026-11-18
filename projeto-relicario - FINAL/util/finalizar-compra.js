const db = require('../banco/database');

let filaCompras = Promise.resolve();

function executar(sql, parametros) {
    return new Promise((resolve, reject) => {
        db.run(sql, parametros || [], function (erro) {
            if (erro) {
                return reject(erro);
            }
            resolve(this);
        });
    });
}

async function executarCompra(itens) {
    await executar('BEGIN IMMEDIATE');

    try {
        for (const item of itens) {
            const resultado = await executar(
                'UPDATE produtos SET estoque = estoque - ? WHERE id = ? AND estoque >= ?',
                [item.quantidade, item.id, item.quantidade]
            );

            if (resultado.changes !== 1) {
                const erro = new Error('Estoque insuficiente ou produto não encontrado.');
                erro.code = 'ESTOQUE_INSUFICIENTE';
                throw erro;
            }
        }

        await executar('COMMIT');
    } catch (erro) {
        try {
            await executar('ROLLBACK');
        } catch (erroRollback) {
            throw new Error(`${erro.message}; erro ao desfazer a transação: ${erroRollback.message}`);
        }
        throw erro;
    }
}

function finalizarCompra(carrinho) {
    if (!Array.isArray(carrinho) || carrinho.length === 0) {
        return Promise.reject(new Error('O carrinho está vazio.'));
    }

    const quantidades = new Map();
    for (const item of carrinho) {
        if (!item || !Number.isSafeInteger(item.id) || item.id <= 0 ||
            !Number.isSafeInteger(item.quantidade) || item.quantidade <= 0) {
            return Promise.reject(new Error('O carrinho contém itens inválidos.'));
        }
        const quantidade = (quantidades.get(item.id) || 0) + item.quantidade;
        if (!Number.isSafeInteger(quantidade)) {
            return Promise.reject(new Error('O carrinho contém quantidades inválidas.'));
        }
        quantidades.set(item.id, quantidade);
    }

    const itens = Array.from(quantidades, ([id, quantidade]) => ({ id, quantidade }));
    const operacao = filaCompras.then(() => executarCompra(itens));
    filaCompras = operacao.catch(() => {});
    return operacao;
}

module.exports = finalizarCompra;
