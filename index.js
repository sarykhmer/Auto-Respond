const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');
const http = require('http');
const fs = require('fs');
const path = require('path');

// 1. Safe Configuration via Cloud Environment Variables
const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const TARGET_GROUP_ID = process.env.TARGET_GROUP_ID;
const savedSessionString = process.env.TELEGRAM_SESSION;

let needWch_on = false;
let moveToArr_on = false;
let replyToMessage_At = 0;

const controlHost = '0.0.0.0';
const controlPort = Number(process.env.SERVER_PORT || process.env.PORT || 3000);
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// Cross-origin support. Set ALLOWED_ORIGIN to one or more origins, comma-separated:
//   ALLOWED_ORIGIN=https://site-a.com,https://yourname.github.io
// Use "*" to allow any origin (anyone could then toggle your settings), or "null" for file:// pages.
// If the variable is not set, it defaults to the local Live Server origins below.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || 'http://127.0.0.1:5500,https://server-controls.vercel.app')
    .split(',')
    .map(origin => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

function send(request, response, status, body, contentType = 'text/plain; charset=utf-8') {
    const headers = {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
        'Vary': 'Origin'
    };

    const origin = request.headers.origin;
    if (origin && (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin))) {
        headers['Access-Control-Allow-Origin'] = ALLOWED_ORIGINS.includes('*') ? '*' : origin;
        headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
        headers['Access-Control-Allow-Headers'] = 'Content-Type';
        headers['Access-Control-Max-Age'] = '600';
    }

    response.writeHead(status, headers);
    response.end(body);
}

const sendJson = (request, response, status, data) =>
    send(request, response, status, JSON.stringify(data), 'application/json');

http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
        send(request, response, 204, '');
        return;
    }

    if (request.method === 'GET' && pathname === '/') {
        send(request, response, 200, indexHtml, 'text/html; charset=utf-8');
        return;
    }

    if (request.method === 'GET' && pathname === '/api/settings') {
        sendJson(request, response, 200, { needWch_on, moveToArr_on });
        return;
    }

    if (request.method === 'POST' && pathname === '/api/settings') {
        if (!request.headers['content-type']?.startsWith('application/json')) {
            send(request, response, 415, 'Expected application/json');
            return;
        }

        let body = '';
        let tooLarge = false;
        request.setEncoding('utf8');
        request.on('data', chunk => {
            if (tooLarge) return;
            body += chunk;
            if (body.length > 1024) {
                tooLarge = true;
                body = '';
            }
        });
        request.on('end', () => {
            if (tooLarge) {
                send(request, response, 413, 'Request body too large');
                return;
            }

            let update;
            try {
                update = JSON.parse(body);
            } catch {
                send(request, response, 400, 'Invalid JSON');
                return;
            }

            if (!update || typeof update !== 'object' || Array.isArray(update) ||
                !['needWch_on', 'moveToArr_on'].includes(update.name) ||
                typeof update.enabled !== 'boolean') {
                send(request, response, 400, 'Expected a setting name and boolean value');
                return;
            }

            if (update.name === 'needWch_on') {
                needWch_on = update.enabled;
            } else {
                moveToArr_on = update.enabled;
            }

            sendJson(request, response, 200, { needWch_on, moveToArr_on });
        });
        return;
    }

    send(request, response, 404, 'Not found');
}).listen(controlPort, controlHost, () => {
    console.log(`Controls available at http://${controlHost}:${controlPort}`);
});

async function replyToMessage(client, incomingText, chatId) {
    try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await client.sendMessage(BigInt(chatId), {
            message: "Note b"
        });
        replyToMessage_At = Date.now() + 60_000;
        console.log(`Replied to message: ${incomingText} =>> Note b`);
    } catch (error) {
        console.error("Error sending message:", error);
    }
}

// 2. Session Handling
const stringSession = new StringSession(savedSessionString);
(async () => {
    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });

    await client.connect();

    console.log("Your server is active and running!");

    // 4. Message Listener Loop
    client.addEventHandler(async (event) => {
        const message = event.message;

        // Check group ID match, and ensure you aren't responding to yourself
        if (message.chatId.toString() === TARGET_GROUP_ID && !message.out) {
            const incomingText = message.text ? message.text.toLowerCase() : "";
            const chatId = message.chatId.toString();
            // need 1 wch
            if (/\bneed\s+1\s*wch\b/.test(incomingText) ||
                /\bneed\s+2\s*wch\b/.test(incomingText) ||
                /\b1\s*wch\s+now\b/.test(incomingText)) {
                if (!needWch_on || Date.now() < replyToMessage_At) {
                    return;
                }
                await replyToMessage(client, incomingText, chatId);
            }

            //move to arr
            if (/\bmove\s+to\s+arr\s*ival\b/.test(incomingText)) {
                if (!moveToArr_on || Date.now() < replyToMessage_At) {
                    return;
                }
                await replyToMessage(client, incomingText, chatId);
            }
        }
    }, new NewMessage({}));
})();
