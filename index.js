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

let needWch_on = true;
let moveToArr_on = false;
let replyToMessage_At = 0;

const controlHost = '127.0.0.1';
const controlPort = 3000;
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

http.createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/') {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(indexHtml);
        return;
    }

    if (request.method === 'GET' && request.url === '/api/settings') {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ needWch_on, moveToArr_on }));
        return;
    }

    if (request.method === 'POST' && request.url === '/api/settings') {
        if (!request.headers['content-type']?.startsWith('application/json')) {
            response.writeHead(415).end('Expected application/json');
            return;
        }

        let body = '';
        let tooLarge = false;
        request.setEncoding('utf8');
        request.on('data', chunk => {
            body += chunk;
            if (body.length > 1024) {
                tooLarge = true;
            }
        });
        request.on('end', () => {
            if (tooLarge) {
                response.writeHead(413).end('Request body too large');
                return;
            }

            let update;
            try {
                update = JSON.parse(body);
            } catch {
                response.writeHead(400).end('Invalid JSON');
                return;
            }

            if (!update || typeof update !== 'object' || Array.isArray(update) ||
                !['needWch_on', 'moveToArr_on'].includes(update.name) ||
                typeof update.enabled !== 'boolean') {
                response.writeHead(400).end('Expected a setting name and boolean value');
                return;
            }

            if (update.name === 'needWch_on') {
                needWch_on = update.enabled;
            } else {
                moveToArr_on = update.enabled;
            }

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ needWch_on, moveToArr_on }));
        });
        return;
    }

    response.writeHead(404).end('Not found');
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
