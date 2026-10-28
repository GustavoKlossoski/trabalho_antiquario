const express = require('express');
const app = express();
const port = 3000;
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
const db = require('./banco/database');
const atualizacoes = require('./util/atualizacoes');

app.get('/eventos/produtos', (req, res) => {
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
    });
    res.flushHeaders();
    res.write('retry: 5000\n\n');

    const notificar = () => res.write('data: produtos-atualizados\n\n');
    const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 25000);
    atualizacoes.on('produtos-atualizados', notificar);

    req.on('close', () => {
        clearInterval(heartbeat);
        atualizacoes.off('produtos-atualizados', notificar);
    });
});

//importa as rotas admin
const appAdmin = require('./rotas/admin');
app.use('/admin', appAdmin);

app.get('/', (req, res) => {
    db.all(
        'SELECT * FROM categorias', 
        [], 
        function (erro, categorias) {
            if (erro) {
                console.log(erro.message);
                return res.send('Erro ao consultar categorias.');
            }
            db.all(
            'SELECT * FROM produtos', 
            [], 
            function (erro, produtos) {
                if (erro) {
                    console.log(erro.message);
                    return res.send('Erro ao consultar produtos.');
                }
                res.render('index.ejs', { categorias, produtos });
            }
    );;
        }
    );
});

app.get('/', (req, res) => {
    db.all('SELECT * FROM categorias', [], function (erro, categorias) {
        if (erro) {
            console.log(erro.message);
            return res.send('Erro ao consultar categorias.');
        }

        //produtos que são destaque 
        db.all('SELECT * FROM produtos WHERE destaque = 1', [], function (erro, produtos) {
            if (erro) {
                console.log(erro.message);
                return res.send('Erro ao consultar produtos.');
            }

            res.render('index.ejs', { categorias, produtos });
        });
    });
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});