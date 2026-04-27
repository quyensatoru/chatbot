import { Client, GatewayIntentBits, TextChannel } from 'discord.js';
import AgentService from '../services/agent.service.js';

const createDiscordBot = async () => {
    const TOKEN = process.env.DISCORD_TOKEN;

    if (!TOKEN) {
        console.log('❌ Missing DISCORD_TOKEN in env');
        return;
    }

    try {
        const client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
            ],
        });

        client.once('ready', () => {
            console.log(`🤖 Bot logged in as ${client.user?.tag}`);
        });

        client.on('messageCreate', async (message) => {
            try {
                if (message.author.bot) return;

                const content = message.content.trim();

                if (!content) return;

                console.log(`📩 ${message.author.username}: ${content}`);

                if (message.channel.isTextBased()) {
                    await message.channel.sendTyping();
                }

                const result = await AgentService.chat([
                    { role: 'user', content },
                ]);

                const reply = result[result.length - 1]?.content || "";

                if (message.channel.isTextBased()) {
                    await (message.channel).send(reply);
                }

                await message.author.send("Hello từ bot 🤖");
            } catch (err) {
                console.error('❌ Error:', err);

                if (message.channel.isTextBased()) {
                    await message.channel.send('⚠️ Bot bị lỗi rồi');
                }
            }
        });

        // reconnect basic
        client.on('error', console.error);
        client.on('shardError', console.error);

        client.login(TOKEN);
    } catch (e) {
        console.error(e)
    }
}

export default createDiscordBot;
