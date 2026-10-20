const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, maxPayload: 1024 });

// Роздаємо статичні файли гри з папки public
app.use(express.static(path.join(__dirname, 'public')));

let nextId = 1;

function broadcast(data, except) {
    wss.clients.forEach((client) => {
        if (client !== except && client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

wss.on('connection', (ws) => {
    // Сервер сам видає кожному гравцю id
    ws.id = String(nextId++);
    console.log('Новий гравець підключився:', ws.id);
    ws.send(JSON.stringify({ type: 'welcome', id: ws.id }));

    ws.on('message', (message) => {
        let d;
        try { d = JSON.parse(message.toString()); } catch (e) { return; }
        if (!d || ![d.x, d.y, d.z, d.rotY].every(Number.isFinite)) return;
        // Пересилаємо координати всім іншим гравцям (id ставить сервер, а не клієнт)
        broadcast(JSON.stringify({
            type: 'pos',
            id: ws.id,
            x: d.x, y: d.y, z: d.z, rotY: d.rotY,
            vis: d.vis ? 1 : 0
        }), ws);
    });

    ws.on('close', () => {
        console.log('Гравець відключився:', ws.id);
        // Кажемо іншим гравцям, щоб видалили його модель
        broadcast(JSON.stringify({ type: 'leave', id: ws.id }), ws);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущено на порту ${PORT}`);
});
