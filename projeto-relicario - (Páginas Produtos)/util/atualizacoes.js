const { EventEmitter } = require('events');

const atualizacoes = new EventEmitter();
atualizacoes.setMaxListeners(0);

module.exports = atualizacoes;