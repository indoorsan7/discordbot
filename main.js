const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const http = require('http');

// 環境変数からトークンとクライアントIDを取得
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
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
    ]
});

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
            {
                name: 'reason',
                type: 3, // STRING
                description: 'ミュート理由',
                required: false,
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
        name: 'auth',
        description: '認証を行います。',
        options: [ // /authコマンドにオプションを追加
            {
                name: 'role',
                type: 8, // ROLE
                description: '認証後に付与するロールを指定します。',
                required: false,
            },
        ],
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
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
});

// スラッシュコマンドが実行されたときの処理
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // interactionがDMで実行された場合のチェック
    if (!interaction.inGuild() && ['ban', 'kick', 'mute', 'unmute', 'unban', 'role'].includes(interaction.commandName)) {
        return interaction.reply({ content: 'このコマンドはサーバーでのみ使用できます。', ephemeral: true });
    }
    
    const { commandName } = interaction;

    if (commandName === 'ping') {
        const ping = client.ws.ping;
        await interaction.reply(`Pong! (${ping}ms)`);
    }

    if (commandName === 'echo') {
        const message = interaction.options.getString('message');
        // 完了メッセージは自分だけに表示
        await interaction.reply({ content: '正常に動作しました。\n(このメッセージはあなただけに表示されています)', ephemeral: true });
        // 本文はそのチャンネルに送信
        await interaction.channel.send(message);
    }

    if (commandName === 'senddm') {
        const target = interaction.options.getUser('target');
        const message = interaction.options.getString('message');
        try {
            await target.send(message);
            await interaction.reply({ content: `<@${target.id}> にDMを送信しました。`, ephemeral: true });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'DMの送信に失敗しました。ユーザーがDMを受け付けていない可能性があります。', ephemeral: true });
        }
    }

    if (commandName === 'ban') {
        const target = interaction.options.getMember('target');
        const reason = interaction.options.getString('reason') || '理由なし';

        if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            return interaction.reply({ content: 'このコマンドを実行する権限がありません。', ephemeral: true });
        }

        if (target.id === interaction.user.id) {
            return interaction.reply({ content: '自分自身を追放することはできません。', ephemeral: true });
        }

        try {
            await target.ban({ reason });
            await interaction.reply(`<@${target.id}> を追放しました。理由: ${reason}`);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'ユーザーを追放できませんでした。Botの権限を確認してください。', ephemeral: true });
        }
    }

    if (commandName === 'kick') {
        const target = interaction.options.getMember('target');
        const reason = interaction.options.getString('reason') || '理由なし';
    
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
            return interaction.reply({ content: 'このコマンドを実行する権限がありません。', ephemeral: true });
        }

        if (target.id === interaction.user.id) {
            return interaction.reply({ content: '自分自身をキックすることはできません。', ephemeral: true });
        }
    
        try {
            await target.kick(reason);
            await interaction.reply(`<@${target.id}> をキックしました。理由: ${reason}`);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'ユーザーをキックできませんでした。Botの権限を確認してください。', ephemeral: true });
        }
    }

    if (commandName === 'mute') {
        const target = interaction.options.getMember('target');
        const duration = interaction.options.getNumber('duration');
        const muteType = interaction.options.getString('mute_type') || 'all';
        const reason = interaction.options.getString('reason') || '理由なし';

        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return interaction.reply({ content: 'このコマンドを実行する権限がありません。', ephemeral: true });
        }

        if (target.id === interaction.user.id) {
            return interaction.reply({ content: '自分自身をミュートすることはできません。', ephemeral: true });
        }

        const timeoutDuration = duration * 60 * 1000; // ミリ秒に変換
        
        try {
            if (muteType === 'voice' || muteType === 'all') {
                if (target.voice.channel) {
                    await target.voice.setMute(true, reason);
                }
            }
            if (muteType === 'text' || muteType === 'all') {
                await target.timeout(timeoutDuration, reason);
            }
            await interaction.reply(`<@${target.id}> を ${duration} 分間ミュートしました。対象: ${muteType}、理由: ${reason}`);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'ユーザーをミュートできませんでした。Botの権限を確認してください。', ephemeral: true });
        }
    }

    if (commandName === 'unmute') {
        const target = interaction.options.getMember('target');
        const reason = interaction.options.getString('reason') || '理由なし';

        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return interaction.reply({ content: 'このコマンドを実行する権限がありません。', ephemeral: true });
        }

        try {
            await target.timeout(null, reason);
            if (target.voice.channel) {
                await target.voice.setMute(false, reason);
            }
            await interaction.reply(`<@${target.id}> のミュートを解除しました。理由: ${reason}`);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'ユーザーのミュートを解除できませんでした。Botの権限を確認してください。', ephemeral: true });
        }
    }

    if (commandName === 'unban') {
        const userId = interaction.options.getString('user_id');
        const reason = interaction.options.getString('reason') || '理由なし';

        if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            return interaction.reply({ content: 'このコマンドを実行する権限がありません。', ephemeral: true });
        }

        try {
            const bannedUser = await interaction.guild.bans.remove(userId, reason);
            if (bannedUser) {
                await interaction.reply(`ユーザーID: ${userId} の追放を解除しました。理由: ${reason}`);
            } else {
                await interaction.reply({ content: '指定されたユーザーIDはBANされていません。', ephemeral: true });
            }
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: `追放を解除できませんでした。エラー: ${error.message}`, ephemeral: true });
        }
    }

    if (commandName === 'role') {
        const subCommand = interaction.options.getSubcommand();
        const target = interaction.options.getMember('target');
        const role = interaction.options.getRole('role');
        const reason = interaction.options.getString('reason') || '理由なし';

        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            return interaction.reply({ content: 'このコマンドを実行する権限がありません。', ephemeral: true });
        }

        try {
            if (subCommand === 'add') {
                await target.roles.add(role);
                await interaction.reply(`<@${target.id}> に ${role.name} ロールを付与しました。`);
            } else if (subCommand === 'remove') {
                await target.roles.remove(role);
                await interaction.reply(`<@${target.id}> から ${role.name} ロールを削除しました。`);
            }
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'ロールの管理に失敗しました。Botの権限を確認してください。', ephemeral: true });
        }
    }
    
    if (commandName === 'auth') {
        // コマンドオプションで指定されたロールを取得
        const authRoleOption = interaction.options.getRole('role');
        let roleToAssign;

        if (authRoleOption) {
            // オプションでロールが指定された場合
            roleToAssign = authRoleOption.id;
        } else if (AUTH_ROLE_ID) {
            // オプションが指定されず、環境変数がある場合
            roleToAssign = AUTH_ROLE_ID;
        } else {
            // どちらも存在しない場合
            await interaction.reply({ content: '認証用のロールが設定されていません。管理者に連絡してください。', ephemeral: true });
            return;
        }

        // 認証用ロールを取得
        const authRole = interaction.guild.roles.cache.get(roleToAssign);
        if (!authRole) {
            await interaction.reply({ content: '指定された認証用のロールが見つかりませんでした。サーバー設定を確認してください。', ephemeral: true });
            return;
        }

        // 既に認証ロールを持っているかチェック
        const member = interaction.guild.members.cache.get(interaction.user.id);
        if (member && member.roles.cache.has(roleToAssign)) {
            // 既に認証されている場合はコマンド実行者のみにメッセージを表示
            await interaction.reply({ content: 'あなたは既に認証されています。', ephemeral: true });
            return;
        }

        // 計算問題を生成
        const num1 = Math.floor(Math.random() * 10) + 1; // 1から10
        const num2 = Math.floor(Math.random() * 10) + 1; // 1から10
        const answer = num1 + num2;
        const problem = `${num1} + ${num2}`;

        // 5つの選択肢を作成
        const choices = [answer];
        while (choices.length < 5) {
            const wrongAnswer = Math.floor(Math.random() * 20) + 1; // 1から20
            if (!choices.includes(wrongAnswer) && wrongAnswer !== answer) {
                choices.push(wrongAnswer);
            }
        }

        // 選択肢をシャッフル
        choices.sort(() => Math.random() - 0.5);

        // ボタンを作成
        const buttons = choices.map(choice => {
            const isCorrect = choice === answer;
            // カスタムIDにロールIDを含めるように変更
            return new ButtonBuilder()
                .setCustomId(`auth_choice_${interaction.user.id}_${roleToAssign}_${isCorrect}_${answer}`)
                .setLabel(String(choice))
                .setStyle(isCorrect ? ButtonStyle.Success : ButtonStyle.Secondary);
        });

        const actionRow = new ActionRowBuilder().addComponents(buttons);
        
        // 認証パネルをそのチャンネルに直接送信
        const authEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('認証')
            .setDescription('こちらから認証をお願いします。');

        await interaction.reply({
            content: `認証を開始します。`,
            ephemeral: true
        });

        // 認証パネルを公開メッセージとして送信
        await interaction.channel.send({
            embeds: [authEmbed],
            components: [actionRow],
        });
    }

    if (commandName === 'help') {
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
                { name: '/auth [role]', value: '認証パネルをチャンネルに表示し、ボタンで認証を行います。ロールを指定しない場合、事前に設定されたロールが付与されます。', inline: false },
                { name: '/help', value: 'このコマンド一覧を表示します。', inline: false }
            );
        await interaction.reply({ embeds: [helpEmbed] });
    }
});

// ボタンがクリックされたときの処理
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    // カスタムIDから各パラメータを抽出
    const [command, userId, roleToAssign, isCorrect, answer] = interaction.customId.split('_'); // 変更点

    if (command === 'auth_choice' && userId === interaction.user.id) {
        // 別のユーザーがボタンを押すのを防ぐ
        if (interaction.user.id !== userId) {
            return interaction.reply({ content: 'このボタンはあなた用ではありません。', ephemeral: true });
        }

        await interaction.deferUpdate();

        // 5つのボタンを無効化
        const disabledButtons = interaction.message.components[0].components.map(button =>
            new ButtonBuilder()
                .setCustomId(button.customId)
                .setLabel(button.label)
                .setStyle(button.style)
                .setDisabled(true)
        );

        const updatedRow = new ActionRowBuilder().addComponents(disabledButtons);

        if (isCorrect === 'true') {
            // 正しい回答の場合、ロールを付与
            const member = interaction.guild.members.cache.get(interaction.user.id);
            const authRole = interaction.guild.roles.cache.get(roleToAssign); // 変更点

            if (member && authRole) {
                await member.roles.add(authRole);
                await interaction.editReply({ 
                    content: '認証に成功しました！',
                    components: [updatedRow],
                });
            } else {
                await interaction.editReply({ 
                    content: '認証は成功しましたが、ロールを付与できませんでした。サーバー管理者に連絡してください。',
                    components: [updatedRow],
                });
            }
        } else {
            // 不正解の場合
            await interaction.editReply({ 
                content: '認証に失敗しました。もう一度試してください。',
                components: [updatedRow],
            });
        }
    }
});

// BotをDiscordにログインさせる
client.login(DISCORD_TOKEN);
