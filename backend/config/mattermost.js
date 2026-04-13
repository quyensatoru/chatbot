import axios from "axios";
import AgentService from "../services/agent.service.js";
import MattermostMemoryService from "../services/mattermost-memory.service.js";
import { v4 as uuidV4 } from "uuid";
import * as crypto from "crypto";


let ws;
const thread = new Map();

async function getUsername(userId) {
  const res = await axios.get(
    `https://chat.bsscommerce.com/api/v4/users/${userId}`,
    {
      headers: {
        Cookie: 'MMAUTHTOKEN=8391o88gqifkpex359yciytggo'
      }
    }
  );

  return res.data.username;
}

function Hash(str) {
  return crypto
    .createHash("sha256")
    .update(str)
    .digest("hex")
}

const channelAllows = [
    "xbbhhag6q3fw78yfupu3wmtapw",
    "ed4mhznxpb8d8qeey8icgjf7pe",
]

const initBotMattermost = () => {
    if(ws) return

    ws = new WebSocket('wss://chat.bsscommerce.com/api/v4/websocket', {
        headers: {
            Cookie: 'MMAUTHTOKEN=8391o88gqifkpex359yciytggo'
        }
    });

    ws.onopen = () => {
        console.log("connect websoket mattermost company successful")
    }

    ws.onclose = () => {
        ws = new WebSocket('wss://chat.bsscommerce.com/api/v4/websocket', {
            headers: {
                Cookie: 'MMAUTHTOKEN=8391o88gqifkpex359yciytggo'
            }
        });
        console.log("disconnect websoket mattermost company successful")
    }

    ws.onmessage = async (msg) => {
        const raw = msg.data;
        try {
            const data = JSON.parse(raw);

            if(!data?.data?.post) {
                return
            }

            const post = JSON.parse(data?.data?.post);
            // console.log("post: ", JSON.stringify(post, null, 2))
            const channelId = post?.channel_id;

            if(data.event === "posted" && channelAllows.includes(channelId)) {
                const message = post?.message;
                const sender = data.data.sender_name;


                if(sender === "@sa_sbc_vaho_bot") {
                    const threadId = thread.get(Hash(message));
                    console.log(thread)
                    console.log("message: ", message.slice(0, 50));
                    console.log("theadid: ", threadId)
                    if(!threadId) {
                        return
                    }

                    await MattermostMemoryService.create({
                        rootId: post.id,
                        channelId: channelId,
                        senderName: sender,
                        threadId,
                        message: {
                            role: "ai",
                            content: message
                        }
                    })
                    
                    return
                }

                const matches = message.match(/@\w+/g);

                let chatHistory = []
                let threadId = null;
                if (post.root_id) {
                    // chat trong thread của bot check xem root id có phải là thread của bot ko
                    const ai = await MattermostMemoryService.findOne({
                        rootId: post.root_id,
                    });


                    if(!ai) {
                        return
                    }

                    threadId = ai.threadId

                    // có nằm trong thread, có tag user nhưng ko tag bot => break
                    if(matches && !matches.includes("@sa_sbc_vaho_bot")) {
                        return
                    }

                    const chat = await MattermostMemoryService.findByThreadId({
                        threadId: threadId,
                        channelId: channelId,
                    })

                    chatHistory = chat.reverse().map(h => h.message);
                } else {
                    // chat trực tiếp trong channel => nếu ko có tag bot => break
                    if(!matches?.includes("@sa_sbc_vaho_bot")) {
                        return
                    }
                    const histories = await MattermostMemoryService.findByChannelId({
                        channelId
                    });

                    if(histories.length) {
                        chatHistory = histories.reverse().map(h => h.message);
                    }
                    threadId = uuidV4();
                }

                const content = message.replace(/@\w+/g, "")

                console.log("chatHistory: ", chatHistory)

                const result = await AgentService.chat([
                    ...chatHistory,
                    {
                        role: "user", content
                    }
                ])

                const ai = result[result.length - 1];
                const reply = ai.content;

                await MattermostMemoryService.create({
                    rootId: post.id,
                    channelId: post.channel_id,
                    threadId: threadId,
                    senderName: sender,
                    message: { role: "user", content: content },
                })

                if(!post.root_id) {
                    thread.set(Hash(`${sender} ${reply}`), threadId)
                }

                await fetch('https://mattermost-bot.bsscommerce.com/send', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        channel_id: channelId,
                        message: `${sender} ${reply}`,
                        id: threadId,
                    }),
                });
            }
        } catch (e) {
            console.error(e)
        }
    };
}

export default initBotMattermost