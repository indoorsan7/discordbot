const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, ActivityType, ChannelType } = require('discord.js');
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
const ticketPanels = new Map();
const rolePanels = new Map();

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
    },
    {
        name: 'ticket-panel',
        description: 'チケットパネルをチャンネルに表示します。',
        default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
        options: [
            {
                name: 'category',
                type: 7,
                channel_types: [ChannelType.GuildCategory],
                description: 'チケットチャンネルを作成するカテゴリー',
                required: true,
            },
            {
                name: 'role1',
                type: 8,
                description: 'チケット閲覧権限を付与する必須ロール',
                required: true,
            },
            {
                name: 'role2',
                type: 8,
                description: 'チケット閲覧権限を付与する任意ロール',
                required: false,
            },
            {
                name: 'role3',
                type: 8,
                description: 'チケット閲覧権限を付与する任意ロール',
                required: false,
            },
            {
                name: 'role4',
                type: 8,
                description: 'チケット閲覧権限を付与する任意ロール',
                required: false,
            },
        ],
    },
    {
        name: 'role-panel',
        description: 'ロール付与パネルをチャンネルに表示します。',
        default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
        options: [
            {
                name: 'role1',
                type: 8,
                description: '付与するロール1 (必須)',
                required: true,
            },
            {
                name: 'role2',
                type: 8,
                description: '付与するロール2 (任意)',
                required: false,
            },
            {
                name: 'role3',
                type: 8,
                description: '付与するロール3 (任意)',
                required: false,
            },
            {
                name: 'role4',
                type: 8,
                description: '付与するロール4 (任意)',
                required: false,
            },
            {
                name: 'role5',
                type: 8,
                description: '付与するロール5 (任意)',
                required: false,
            },
        ],
    },
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

    try {
        if (commandName === 'ping') {
            const ping = client.ws.ping;
            await interaction.reply(`Pong! (${ping}ms)`);
        } else if (commandName === 'echo') {
            const message = interaction.options.getString('message');
            await interaction.reply({ content: '正常に動作しました。\n(このメッセージはあなただけに表示されています)', ephemeral: true });
            await interaction.channel.send(message);
        } else if (commandName === 'senddm') {
            const target = interaction.options.getMember('target');
            const message = interaction.options.getString('message');
            
            try {
                await target.send(message);
                await interaction.reply({ content: `<@${target.id}>にDMを送信しました。`, ephemeral: true });
            } catch (error) {
                await interaction.reply({ content: 'DMの送信に失敗しました。', ephemeral: true });
                console.error(error);
            }
        } else if (commandName === 'auth-panel') {
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
        } else if (commandName === 'auth') {
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
                    { name: '/ticket-panel <category> <role1> [role2] [role3] [role4]', value: 'チケットパネルをチャンネルに表示し、チケット作成ボタンを設置します。チケットチャンネルは指定されたカテゴリーに作成され、指定したロールに閲覧権限が付与されます。', inline: false },
                    { name: '/role-panel <role1> [role2] [role3] [role4] [role5]', value: '絵文字リアクションでロールを付与・削除できるパネルをチャンネルに表示します。', inline: false },
                    { name: '/help', value: 'このコマンド一覧を表示します。', inline: false }
                );
            await interaction.reply({ embeds: [helpEmbed] });
        } else if (commandName === 'ticket-panel') {
            const ticketCategory = interaction.options.getChannel('category');
            const rolesToAssign = [
                interaction.options.getRole('role1')?.id,
                interaction.options.getRole('role2')?.id,
                interaction.options.getRole('role3')?.id,
                interaction.options.getRole('role4')?.id,
            ].filter(id => id);

            if (!ticketCategory || rolesToAssign.length === 0) {
                return interaction.reply({ content: 'チケットパネルを送信するには、カテゴリーと最低1つのロールを指定する必要があります。', ephemeral: true });
            }

            const panelId = Math.random().toString(36).substring(7);
            ticketPanels.set(panelId, { categoryId: ticketCategory.id, roles: rolesToAssign });

            await interaction.reply({
                content: 'チケットパネルをチャンネルに送信しました。',
                ephemeral: true
            });

            const ticketButton = new ButtonBuilder()
                .setCustomId(`ticket_create_${panelId}`)
                .setLabel('チケットを作成')
                .setStyle(ButtonStyle.Success);

            const actionRow = new ActionRowBuilder().addComponents(ticketButton);
            
            const ticketEmbed = new EmbedBuilder()
                .setColor('#32CD32')
                .setTitle('チケット作成')
                .setDescription('以下のボタンを押してチケットを作成してください。');

            await interaction.channel.send({
                embeds: [ticketEmbed],
                components: [actionRow],
            });
        } else if (commandName === 'role-panel') {
            const roleOptions = [
                interaction.options.getRole('role1'),
                interaction.options.getRole('role2'),
                interaction.options.getRole('role3'),
                interaction.options.getRole('role4'),
                interaction.options.getRole('role5'),
            ].filter(role => role !== null);

            if (roleOptions.length === 0) {
                return interaction.reply({ content: 'ロールパネルを送信するには、最低1つのロールを指定する必要があります。', ephemeral: true });
            }

            const panelId = Math.random().toString(36).substring(7);
            const rolesWithEmojis = roleOptions.map((role, index) => {
                const emojis = ['🅰️', '🅱️', '🇨', '🇩', '🇪'];
                return { id: role.id, name: role.name, emoji: emojis[index] || '❓' };
            });
            rolePanels.set(panelId, rolesWithEmojis);

            await interaction.reply({
                content: 'ロールパネルをチャンネルに送信しました。',
                ephemeral: true
            });

            const roleEmbed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('ロール選択パネル')
                .setDescription('以下のボタンをクリックしてロールを付与・削除してください。');
            
            const actionRows = [];
            let currentRow = new ActionRowBuilder();
            let buttonsInRow = 0;

            rolesWithEmojis.forEach((roleInfo) => {
                const roleButton = new ButtonBuilder()
                    .setCustomId(`role_toggle_${panelId}_${roleInfo.id}`)
                    .setLabel(roleInfo.name)
                    .setEmoji(roleInfo.emoji)
                    .setStyle(ButtonStyle.Secondary);
                
                if (buttonsInRow < 5) {
                    currentRow.addComponents(roleButton);
                    buttonsInRow++;
                } else {
                    actionRows.push(currentRow);
                    currentRow = new ActionRowBuilder().addComponents(roleButton);
                    buttonsInRow = 1;
                }
            });
            actionRows.push(currentRow);

            rolesWithEmojis.forEach(roleInfo => {
                roleEmbed.addFields({ name: `${roleInfo.emoji} ${roleInfo.name}`, value: `このボタンで <@&${roleInfo.id}> ロールを付与・削除します。`, inline: false });
            });

            await interaction.channel.send({
                embeds: [roleEmbed],
                components: actionRows,
            });

        }
    } catch (error) {
        console.error('コマンド処理中にエラーが発生しました:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'コマンドの実行中にエラーが発生しました。', ephemeral: true });
        } else if (interaction.deferred) {
            await interaction.editReply({ content: 'コマンドの実行中にエラーが発生しました。', ephemeral: true });
        }
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    try {
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
                guildId: interaction.guild.id,
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
        } else if (interaction.customId.startsWith('ticket_create_')) {
            await interaction.deferReply({ ephemeral: true });

            const [_, __, panelId] = interaction.customId.split('_');
            const panelConfig = ticketPanels.get(panelId);

            if (!panelConfig) {
                return interaction.editReply({ content: 'このチケットパネルは無効です。再度作成してください。' });
            }

            const { categoryId, roles } = panelConfig;
            const guild = interaction.guild;
            const member = interaction.member;

            if (!guild || !member) {
                return interaction.editReply({ content: 'この操作はサーバー内でのみ実行可能です。' });
            }

            const existingTicketChannel = guild.channels.cache.find(c =>
                c.name.startsWith(`ticket-${member.user.username.toLowerCase().replace(/[^a-z0-9-]/g, '')}`) &&
                c.parentId === categoryId
            );

            if (existingTicketChannel) {
                return interaction.editReply({
                    content: `あなたはすでにチケットを持っています: ${existingTicketChannel}`,
                });
            }
            
            const channelName = `ticket-${member.user.username.toLowerCase().replace(/[^a-z0-9-]/g, '')}`;

            const permissionOverwrites = [
                {
                    id: guild.id,
                    deny: [PermissionsBitField.Flags.ViewChannel],
                },
                {
                    id: member.id,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
                },
                {
                    id: client.user.id,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
                },
            ];
            
            roles.forEach(roleId => {
                if (roleId) {
                    permissionOverwrites.push({
                        id: roleId,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
                    });
                }
            });

            try {
                const newChannel = await guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildText,
                    parent: categoryId,
                    permissionOverwrites: permissionOverwrites,
                });

                const closeButton = new ButtonBuilder()
                    .setCustomId('ticket_close')
                    .setLabel('終了')
                    .setStyle(ButtonStyle.Danger);

                const actionRow = new ActionRowBuilder().addComponents(closeButton);

                const rolesMention = roles.map(id => `<@&${id}>`).join(', ');

                const ticketEmbed = new EmbedBuilder()
                    .setColor('#32CD32')
                    .setTitle('チケットが開かれました')
                    .setDescription(`サポートが必要な内容をこちらに記入してください。担当者が対応します。
このチャンネルは、あなたと ${rolesMention} のみに表示されています。`);

                await newChannel.send({
                    content: `${member}`,
                    embeds: [ticketEmbed],
                    components: [actionRow]
                });

                await interaction.editReply({
                    content: `チケットが作成されました: ${newChannel}`,
                });

            } catch (error) {
                console.error('チケットチャンネルの作成中にエラーが発生しました:', error);
                await interaction.editReply({ content: 'チケットの作成に失敗しました。', ephemeral: true });
            }
        } else if (interaction.customId === 'ticket_close') {
            await interaction.deferReply();
            try {
                await interaction.editReply({ content: 'チケットを終了します。このチャンネルは数秒後に削除されます。' });
                setTimeout(() => {
                    interaction.channel.delete('チケットが終了されました');
                }, 3000);
            } catch (error) {
                console.error('チケットチャンネルの削除中にエラーが発生しました:', error);
                await interaction.editReply({ content: 'チケットの削除に失敗しました。', ephemeral: true });
            }
        } else if (interaction.customId.startsWith('role_toggle_')) {
            await interaction.deferReply({ ephemeral: true });

            const [_, __, panelId, roleIdToToggle] = interaction.customId.split('_');
            const member = interaction.member;
            const guild = interaction.guild;

            if (!member || !guild) {
                return interaction.editReply({ content: 'この操作はサーバー内でのみ実行可能です。' });
            }

            const role = guild.roles.cache.get(roleIdToToggle);
            if (!role) {
                return interaction.editReply({ content: '指定されたロールが見つかりませんでした。' });
            }

            try {
                if (member.roles.cache.has(roleIdToToggle)) {
                    await member.roles.remove(role);
                    await interaction.editReply({ content: `${role.name} ロールを削除しました。` });
                } else {
                    await member.roles.add(role);
                    await interaction.editReply({ content: `${role.name} ロールを付与しました。` });
                }
            } catch (error) {
                console.error('ロールの付与/削除中にエラーが発生しました:', error);
                await interaction.editReply({ content: 'ロールの変更に失敗しました。Botの権限を確認してください。', ephemeral: true });
            }
        }
    } catch (error) {
        console.error('ボタン処理中にエラーが発生しました:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'ボタンの実行中にエラーが発生しました。', ephemeral: true });
        } else if (interaction.deferred) {
            await interaction.editReply({ content: 'ボタンの実行中にエラーが発生しました。', ephemeral: true });
        }
    }
});

client.login(DISCORD_TOKEN);
