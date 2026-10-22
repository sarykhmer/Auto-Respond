const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');

// 1. Configuration
const apiId = 39589438; // Replace with your api_id from my.telegram.org
const apiHash = '542e033042efcd385b802776ca07af97'; // Replace with your api_hash from my.telegram.org
const TARGET_GROUP_ID = "-1004410264257"; // Replace with your target group ID
const savedSessionString = "1BQANOTEuMTA4LjU2LjExMwG7L3pcMppoWiClR5d/wJh1OzXX1Ko/xsqxl8KhmRpiKDVWzKSv1aQkHgIxLZCpied8cNGa3gdMGrREcRaeIMt0tuO+ZjJCqrR2FPwLbsZ7LD/hYSM9aJfnySEQmVXqKO/yiRQNR4vgp2uVqHchvRUB/m/JzmBX4FLeNCj5Qyi021DwcDmrXZnGfSJyx1Tq3AJU13p0HxYUWic2r5qx8y+T5L6n4XjOVVyXUnfbtL1ffftO5zzDFMuYtp4qUuig1x8vBplBUWTiMFZTb1FiRGl/0n2BSSo9B6wwhhFQUEvIKqRSYUKXuUUSaZtvPinJyGPkyexNI6qLS2PgWZTBIVkMcw==";

// 2. Session Handling
const stringSession = new StringSession(savedSessionString);

(async () => {
    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });

    await client.connect();

    console.log("Your Telegram Auto-Responder is active and running!");

    // 4. Message Listener Loop
    client.addEventHandler(async (event) => {
        const message = event.message;

        // Check group ID match, and ensure you aren't responding to yourself
        if (message.chatId.toString() === TARGET_GROUP_ID && !message.out) {
            const incomingText = message.text ? message.text.toLowerCase() : "";

            // Example Keyword Trigger
            if (incomingText.includes("need 1wch")) {
                // await new Promise(resolve => setTimeout(resolve, 0));
                await client.sendMessage(BigInt(message.chatId.toString()), {
                    message: "note b"
                });
                console.log(`Replied to message ID: ${message.id}`);
            }
        }
    }, new NewMessage({}));
})();