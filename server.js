const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, maxPayload: 1024 });

// Роздаємо статичні файли гри з поточної папки
app.use(express.static(__dirname));

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
        if (!d || typeof d !== 'object') return;

        // Чат: чистимо текст, обмежуємо частоту, розсилаємо всім (і відправнику теж)
        if (d.type === 'chat') {
            const now = Date.now();
            if (now - (ws.lastChat || 0) < 400) return; // анти-спам
            const text = typeof d.t === 'string' ? d.t.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 120) : '';
            if (!text) return;
            ws.lastChat = now;
            const nick = typeof d.n === 'string' ? d.n.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) : '';
            broadcast(JSON.stringify({ type: 'chat', id: ws.id, n: nick, t: text }), null);
            return;
        }

        // Синхронізація позиції
        if (![d.x, d.y, d.z, d.rotY].every(Number.isFinite)) return;
        broadcast(JSON.stringify({
            type: 'pos',
            id: ws.id,
            x: d.x, y: d.y, z: d.z, rotY: d.rotY,
            n: typeof d.n === 'string' ? d.n.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) : '',
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
    console.log('Сервер запущено на порту ' + PORT);
});
