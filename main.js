const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, ActivityType } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const http = require('http');

// 環境変数からトークンとクライアントIDを取得
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
// 認証用ロールのIDを環境変数から取得
const AUTH_ROLE_ID = process.env.AUTH_ROLE_ID;

// HTTPサーバーを作成してBotを常時起動させる
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot is alive!');
});

// BotがKoyeb上で実行されているかを確認
const port = process.env.PORT || 8000;
server.listen(port, () => {
    console.log(`Web server listening on port ${port}`);
});

// intentsの設定 (必要な権限を付与)
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent, // DMでの認証番号入力に対応するため
    ]
});

// 認証コードとユーザー情報を一時的に保存するマップ
const authChallenges = new Map();

// スラッシュコマンドの定義
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
            type: 3, // STRING
            description: '繰り返したいメッセージ',
            required: true,
        }],
        // 管理者権限が必要
        default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
    },
    {
        name: 'senddm',
        description: '指定したユーザーにBot経由でDMを送信します。',
        options: [
            {
                name: 'target',
                type: 6, // USER
                description: 'DMを送信するユーザー',
                required: true,
            },
            {
                name: 'message',
                type: 3, // STRING
                description: '送信するメッセージ',
                required: true,
            },
        ],
        // 管理者権限が必要
        default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
    },
    {
        name: 'ban',
        description: '指定したユーザーをサーバーから追放します。',
        options: [
            {
                name: 'target',
                type: 6, // USER
                description: '追放するユーザー',
                required: true,
            },
            {
                name: 'reason',
                type: 3, // STRING
                description: '追放理由',
                required: false,
            },
        ],
        default_member_permissions: PermissionsBitField.Flags.BanMembers.toString(),
    },
    {
        name: 'kick',
        description: '指定したユーザーをサーバーからキックします。',
        options: [
            {
                name: 'target',
                type: 6, // USER
                description: 'キックするユーザー',
                required: true,
            },
            {
                name: 'reason',
                type: 3, // STRING
                description: 'キック理由',
                required: false,
            },
        ],
        default_member_permissions: PermissionsBitField.Flags.KickMembers.toString(),
    },
    {
        name: 'mute',
        description: '指定したユーザーを一定期間ミュートします。',
        options: [
            {
                name: 'target',
                type: 6, // USER
                description: 'ミュートするユーザー',
                required: true,
            },
            {
                name: 'duration',
                type: 10, // NUMBER
                description: 'ミュートする期間（分）',
                required: true,
            },
            {
                name: 'mute_type',
                type: 3, // STRING
                description: 'ミュートの種類',
                required: false,
                choices: [
                    { name: 'voice', value: 'voice' },
                    { name: 'text', value: 'text' },
                    { name: 'all', value: 'all' },
                ],
            },
        ],
        default_member_permissions: PermissionsBitField.Flags.ModerateMembers.toString(),
    },
    {
        name: 'unmute',
        description: '指定したユーザーのミュートを解除します。',
        options: [
            {
                name: 'target',
                type: 6, // USER
                description: 'ミュートを解除するユーザー',
                required: true,
            },
            {
                name: 'reason',
                type: 3, // STRING
                description: 'ミュート解除理由',
                required: false,
            },
        ],
        default_member_permissions: PermissionsBitField.Flags.ModerateMembers.toString(),
    },
    {
        name: 'unban',
        description: '追放したユーザーの追放を解除します。',
        options: [
            {
                name: 'user_id',
                type: 3, // STRING
                description: '追放を解除するユーザーのID',
                required: true,
            },
            {
                name: 'reason',
                type: 3, // STRING
                description: '追放解除理由',
                required: false,
            },
        ],
        default_member_permissions: PermissionsBitField.Flags.BanMembers.toString(),
    },
    {
        name: 'role',
        description: 'ロールを管理します。',
        options: [
            {
                name: 'add',
                description: 'ユーザーにロールを付与します。',
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: 'target',
                        type: 6, // USER
                        description: 'ロールを付与するユーザー',
                        required: true,
                    },
                    {
                        name: 'role',
                        type: 8, // ROLE
                        description: '付与するロール',
                        required: true,
                    },
                ],
            },
            {
                name: 'remove',
                description: 'ユーザーからロールを削除します。',
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: 'target',
                        type: 6, // USER
                        description: 'ロールを削除するユーザー',
                        required: true,
                    },
                    {
                        name: 'role',
                        type: 8, // ROLE
                        description: '削除するロール',
                        required: true,
                    },
                ],
            },
        ],
        default_member_permissions: PermissionsBitField.Flags.ManageRoles.toString(),
    },
    {
        name: 'auth-panel', // コマンド名を変更
        description: '認証パネルをチャンネルに表示します。',
        // /auth-panelコマンドは管理者のみ実行可能にする
        default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
        options: [
            {
                name: 'role',
                type: 8, // ROLE
                description: '認証後に付与するロールを指定します。',
                required: false,
            },
        ],
    },
    {
        name: 'auth',
        description: '認証コードを入力して認証を完了します。',
        options: [
            {
                name: 'code',
                type: 3, // STRING
                description: 'DMに送信された認証コード',
                required: true,
            },
        ],
        // /authコマンドはDMでも実行可能にするため、権限は設定しない
    },
    {
        name: 'help',
        description: 'Botのコマンド一覧を表示します。',
    }
];

// Botが起動し、ログインできたときの処理
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
    
    // ping値を取得
    const ping = client.ws.ping;
    // ステータスを「/help | <ping>ms を再生中」に設定
    client.user.setPresence({
        activities: [{
            name: `/help | ${ping}ms`,
            type: ActivityType.Playing,
        }],
        status: 'online',
    });
});

// スラッシュコマンドが実行されたときの処理
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    
    const { commandName } = interaction;

    // interactionがDMで実行された場合のチェック
    if (!interaction.inGuild() && ['ban', 'kick', 'mute', 'unmute', 'unban', 'role', 'auth-panel', 'ping', 'echo', 'senddm', 'help'].includes(commandName)) {
        // DMでも実行できるコマンドはここでは処理しない
    }
    
    if (interaction.inGuild() && commandName === 'ping') {
        const ping = client.ws.ping;
        await interaction.reply(`Pong! (${ping}ms)`);
    }

    if (interaction.inGuild() && commandName === 'echo') {
        const message = interaction.options.getString('message');
        await interaction.reply({ content: '正常に動作しました。\n(このメッセージはあなただけに表示されています)', ephemeral: true });
        await interaction.channel.send(message);
    }

    // /auth-panel コマンドの処理
    if (commandName === 'auth-panel') {
        await interaction.reply({
            content: '認証パネルをチャンネルに送信しました。',
            ephemeral: true
        });
        
        const authRoleOption = interaction.options.getRole('role');
        const roleToAssign = authRoleOption ? authRoleOption.id : AUTH_ROLE_ID;

        if (!roleToAssign) {
            await interaction.followUp({ content: '認証用のロールが設定されていません。管理者に連絡してください。', ephemeral: true });
            return;
        }

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

    // /auth コマンドの処理 (DMとサーバー両方で実行可能)
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
        
        // 認証コードの有効期限チェック (10分)
        if (Date.now() - authData.timestamp > 10 * 60 * 1000) {
            authChallenges.delete(userId);
            return interaction.reply({
                content: '認証コードの有効期限が切れました。もう一度認証ボタンからやり直してください。',
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
                authChallenges.delete(userId); // 認証成功後はコードを削除
                return interaction.reply({
                    content: `認証に成功しました！ ${authRole.name} ロールを付与しました。`,
                    ephemeral: true // 認証成功メッセージはユーザーにのみ表示
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
            .setColor('ADFF2F') // 黄緑色
            .addFields(
                { name: '/ping', value: 'Botの応答時間をテストします。', inline: false },
                { name: '/echo <message>', value: '入力したメッセージを繰り返します。', inline: false },
                { name: '/senddm <target> <message>', value: '指定したユーザーにDMを送信します。', inline: false },
                { name: '/ban <target> [reason]', value: 'ユーザーをサーバーから追放します。`Ban Members`権限が必要です。', inline: false },
                { name: '/kick <target> [reason]', value: 'ユーザーをサーバーからキックします。`Kick Members`権限が必要です。', inline: false },
                { name: '/mute <target> <duration> [type] [reason]', value: 'ユーザーを一定期間ミュートします。`Moderate Members`権限が必要です。`type`は`voice`, `text`, `all`から選択可能です。', inline: false },
                { name: '/unban <user_id> [reason]', value: '追放したユーザーの追放を解除します。`Ban Members`権限が必要です。', inline: false },
                { name: '/unmute <target> [reason]', value: 'ユーザーのミュートを解除します。`Moderate Members`権限が必要です。', inline: false },
                { name: '/role add <target> <role>', value: '指定したユーザーにロールを付与します。`Manage Roles`権限が必要です。', inline: false },
                { name: '/role remove <target> <role>', value: '指定したユーザーからロールを削除します。`Manage Roles`権限が必要です。', inline: false },
                { name: '/auth-panel [role]', value: '認証パネルをチャンネルに表示し、ボタンで認証を開始します。ロールを指定しない場合、事前に設定されたロールが付与されます。このコマンドは管理者権限が必要です。', inline: false },
                { name: '/auth <code>', value: 'DMで送信された認証コードを入力して認証を完了します。', inline: false },
                { name: '/help', value: 'このコマンド一覧を表示します。', inline: false }
            );
        await interaction.reply({ embeds: [helpEmbed] });
    }
});

// ボタンがクリックされたときの処理
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    if (interaction.customId.startsWith('auth_start_')) {
        await interaction.deferReply({ ephemeral: true });
        
        const [_, __, roleToAssign] = interaction.customId.split('_');
        
        const member = interaction.guild.members.cache.get(interaction.user.id);
        if (member && member.roles.cache.has(roleToAssign)) {
            return interaction.editReply({ content: 'あなたは既に認証されています。' });
        }

        // 10から30までのランダムな数字を生成
        const num1 = Math.floor(Math.random() * (30 - 10 + 1)) + 10;
        // 31から60までのランダムな数字を生成
        const num2 = Math.floor(Math.random() * (60 - 31 + 1)) + 31;
        
        // 認証コードを計算
        const authCode = (num1 + num2).toString();
        
        // 認証情報を一時保存
        authChallenges.set(interaction.user.id, {
            code: authCode,
            guildId: interaction.guildId,
            roleToAssign: roleToAssign,
            timestamp: Date.now() // タイムスタンプを保存
        });

        // DMに送信する埋め込みメッセージを作成
        const dmEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('認証コードを送信しました')
            .setDescription('DMに認証番号を送信しましたので、確認後` /auth 認証番号`をDMで入力してください。認証番号は以下の数式の結果です。');

        const codeEmbed = new EmbedBuilder()
            .setColor('#f0f0f0')
            .setTitle('数式')
            .setDescription(`\`${num1} + ${num2} = ?\``);
        
        try {
            await interaction.user.send({ embeds: [dmEmbed, codeEmbed] });
            await interaction.editReply({
                content: '認証コードをDMに送信しました。ご確認ください。',
            });
        } catch (error) {
            console.error('DM送信中にエラーが発生しました:', error);
            authChallenges.delete(interaction.user.id); // 失敗したらコードを削除
            await interaction.editReply({
                content: 'DMの送信に失敗しました。DM設定をご確認ください。',
            });
        }
    }
});

// BotをDiscordにログインさせる
client.login(DISCORD_TOKEN);
