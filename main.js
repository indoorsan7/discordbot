const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, ActivityType } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const http = require('http');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const AUTH_ROLE_ID = process.env.AUTH_ROLE_ID;

const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot is alive!');
});

const port = process.env.PORT || 8000;
server.listen(port, () => {
    console.log(`Web server listening on port ${port}`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
    ]
});

const authChallenges = new Map();

const commands = [
    {
        name: 'ping',
        description: 'Botの応答時間をテストします。',
    },
    {
        name: 'echo',
        description: '入力したメッセージを繰り返します。',
        options: [{
            name: 'message',
            type: 3,
            description: '繰り返したいメッセージ',
            required: true,
        }],
        default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
    },
    {
        name: 'senddm',
        description: '指定したユーザーにBot経由でDMを送信します。',
        options: [
            {
                name: 'target',
                type: 6,
                description: 'DMを送信するユーザー',
                required: true,
            },
            {
                name: 'message',
                type: 3,
                description: '送信するメッセージ',
                required: true,
            },
        ],
        default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
    },
    {
        name: 'auth-panel',
        description: '認証パネルをチャンネルに表示します。',
        default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
        options: [
            {
                name: 'role',
                type: 8,
                description: '認証後に付与するロールを指定します。',
                required: true,
            },
        ],
    },
    {
        name: 'auth',
        description: '認証コードを入力して認証を完了します。',
        options: [
            {
                name: 'code',
                type: 3,
                description: 'DMに送信された認証コード',
                required: true,
            },
        ],
    },
    {
        name: 'help',
        description: 'Botのコマンド一覧を表示します。',
    }
];

client.on('ready', async () => {
    console.log(`${client.user.tag} にログインしました！`);

    try {
        const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
        console.log('Started refreshing application (/) commands.');
        if (GUILD_ID) {
            await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        } else {
            await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        }
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
    
    client.user.setPresence({
        activities: [{
            name: `/help`,
            type: ActivityType.Playing,
        }],
        status: 'online',
    });
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    
    const { commandName } = interaction;

    if (commandName === 'ping') {
        const ping = client.ws.ping;
        await interaction.reply(`Pong! (${ping}ms)`);
    }

    if (commandName === 'echo') {
        const message = interaction.options.getString('message');
        await interaction.reply({ content: '正常に動作しました。\n(このメッセージはあなただけに表示されています)', ephemeral: true });
        await interaction.channel.send(message);
    }

    if (commandName === 'senddm') {
        const target = interaction.options.getMember('target');
        const message = interaction.options.getString('message');
        
        try {
            await target.send(message);
            await interaction.reply({ content: `<@${target.id}>にDMを送信しました。`, ephemeral: true });
        } catch (error) {
            await interaction.reply({ content: 'DMの送信に失敗しました。', ephemeral: true });
            console.error(error);
        }
    }

    if (commandName === 'auth-panel') {
        const authRoleOption = interaction.options.getRole('role');
        
        if (!authRoleOption) {
            await interaction.reply({ content: '認証パネルを送信するには、付与するロールを指定する必要があります。', ephemeral: true });
            return;
        }

        await interaction.reply({
            content: '認証パネルをチャンネルに送信しました。',
            ephemeral: true
        });

        const roleToAssign = authRoleOption.id;

        const authButton = new ButtonBuilder()
            .setCustomId(`auth_start_${roleToAssign}`)
            .setLabel('認証')
            .setStyle(ButtonStyle.Primary);

        const actionRow = new ActionRowBuilder().addComponents(authButton);
        
        const authEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('認証')
            .setDescription('こちらから認証をお願いします。');

        await interaction.channel.send({
            embeds: [authEmbed],
            components: [actionRow],
        });
    }

    if (commandName === 'auth') {
        const code = interaction.options.getString('code');
        const userId = interaction.user.id;
        const authData = authChallenges.get(userId);

        if (!authData) {
            return interaction.reply({
                content: '認証リクエストが見つかりません。まずサーバーで認証ボタンを押してください。',
                ephemeral: true
            });
        }
        
        if (Date.now() - authData.timestamp > 3 * 60 * 1000) {
            authChallenges.delete(userId);
            return interaction.reply({
                content: '有効な認証コードが見当たりません。もう一度認証ボタンからやり直してください。',
                ephemeral: true
            });
        }

        if (authData.code === code) {
            const guild = client.guilds.cache.get(authData.guildId);
            if (!guild) {
                return interaction.reply({ content: '認証したサーバーが見つかりません。', ephemeral: true });
            }
            const member = await guild.members.fetch(userId);
            const authRole = guild.roles.cache.get(authData.roleToAssign);

            if (member && authRole) {
                await member.roles.add(authRole);
                authChallenges.delete(userId);
                return interaction.reply({
                    content: `認証に成功しました！ ${authRole.name} ロールを付与しました。`,
                    ephemeral: true
                });
            } else {
                return interaction.reply({
                    content: '認証は成功しましたが、ロールを付与できませんでした。サーバー管理者に連絡してください。',
                    ephemeral: true
                });
            }
        } else {
            return interaction.reply({
                content: '認証コードが正しくありません。もう一度お試しください。',
                ephemeral: true
            });
        }
    } else if (commandName === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('Bot Commands List')
            .setDescription('利用可能なコマンドとその説明です。')
            .setColor('ADFF2F')
            .addFields(
                { name: '/ping', value: 'Botの応答時間をテストします。', inline: false },
                { name: '/echo <message>', value: '入力したメッセージを繰り返します。', inline: false },
                { name: '/senddm <target> <message>', value: '指定したユーザーにDMを送信します。', inline: false },
                { name: '/auth-panel <role>', value: '認証パネルをチャンネルに表示し、ボタンで認証を開始します。付与するロールの指定は必須です。このコマンドは管理者権限が必要です。', inline: false },
                { name: '/auth <code>', value: 'DMで送信された認証コードを入力して認証を完了します。', inline: false },
                { name: '/help', value: 'このコマンド一覧を表示します。', inline: false }
            );
        await interaction.reply({ embeds: [helpEmbed] });
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    if (interaction.customId.startsWith('auth_start_')) {
        await interaction.deferReply({ ephemeral: true });
        
        const [_, __, roleToAssign] = interaction.customId.split('_');
        
        const member = interaction.guild.members.cache.get(interaction.user.id);
        if (member && member.roles.cache.has(roleToAssign)) {
            return interaction.editReply({ content: 'あなたは既に認証されています。' });
        }

        const num1 = Math.floor(Math.random() * (30 - 10 + 1)) + 10;
        const num2 = Math.floor(Math.random() * (60 - 31 + 1)) + 31;
        
        const authCode = (num1 + num2).toString();
        const equation = `${num1} + ${num2}`;
        
        authChallenges.set(interaction.user.id, {
            code: authCode,
            equation: equation,
            guildId: interaction.guildId,
            roleToAssign: roleToAssign,
            timestamp: Date.now()
        });

        const dmEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('認証コード')
            .setDescription(`認証コードを送信しました。認証番号は以下の数式の答えです。
有効時間は3分です。

**${equation}**

この数式の答えを認証番号として、DMで \`/auth 認証番号\` と入力してください。`);
        
        try {
            await interaction.user.send({ embeds: [dmEmbed] });
            await interaction.editReply({
                content: '認証コードをDMに送信しました。ご確認ください。',
            });
        } catch (error) {
            console.error('DM送信中にエラーが発生しました:', error);
            authChallenges.delete(interaction.user.id);
            await interaction.editReply({
                content: 'DMの送信に失敗しました。DM設定をご確認ください。',
            });
        }
    }
});

client.login(DISCORD_TOKEN);
