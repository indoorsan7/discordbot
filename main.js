const { Client, Collection, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, REST, Routes, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, ActivityType } = require('discord.js');
const http = require('http');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// Webサーバーの起動（Renderのヘルスチェック用）
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot is alive!');
});

const port = process.env.PORT || 8000;
server.listen(port, () => {
    console.log(`Web server listening on port ${port}`);
});

// Discordクライアントの初期化
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
    ],
});

client.commands = new Collection();

// === いんコインデータ（メモリに保存されます。ボット再起動でリセットされます） ===
const userBalances = new Map(); // key: userId, value: coins
const userLastWorkTime = new Map(); // key: userId, value: timestamp
const userLastRobTime = new Map(); // key: userId, value: timestamp
const channelChatRewards = new Map(); // key: channelId, value: { min, max }
// ===================================================================

const authChallenges = new Map(); // 認証チャレンジ用（一時データ）
const ticketPanels = new Map();   // チケットパネル設定用（一時データ）

/**
 * ユーザーのいんコイン残高をメモリから取得します。
 * @param {string} userId - ユーザーID
 * @returns {number} - ユーザーのいんコイン残高
 */
function getCoins(userId) {
    return userBalances.get(userId) || 0;
}

/**
 * ユーザーのいんコイン残高をメモリで更新します。
 * @param {string} userId - ユーザーID
 * @param {number} amount - 追加または減算する金額
 * @returns {number} - 更新後のユーザーのいんコイン残高
 */
function addCoins(userId, amount) {
    const currentCoins = getCoins(userId);
    let newCoins = currentCoins + amount;
    if (newCoins < 0) {
        newCoins = 0; // 残高がマイナスにならないようにする
    }
    userBalances.set(userId, newCoins);
    return newCoins;
}

// --- コマンド定義 ---

// === ギルド（サーバー）限定コマンド ===

const gamblingCommand = {
    data: new SlashCommandBuilder()
        .setName('gambling')
        .setDescription('いんコインを賭けてギャンブルをします。')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('賭けるいんコインの金額')
                .setRequired(true)
                .setMinValue(1)),
    default_member_permissions: null, // @everyoneが使用可能
    async execute(interaction) {
        const userId = interaction.user.id;
        const betAmount = interaction.options.getInteger('amount');

        const currentCoins = getCoins(userId);

        if (currentCoins < betAmount) {
            return interaction.reply({ content: `いんコインが足りません！現在 ${currentCoins} いんコイン持っています。`, ephemeral: true });
        }
        if (betAmount === 0) { // setMinValue(1)で対応済みだが念のため
            return interaction.reply({ content: '賭け金が0いんコインではギャンブルできません。', ephemeral: true });
        }

        addCoins(userId, -betAmount);

        const successChance = 0.125; // 当たりの確率 12.5%

        let multiplier;
        if (Math.random() < successChance) {
            // 勝利の場合：2.0から2.5倍
            multiplier = Math.random() * (2.5 - 2.0) + 2.0;
        } else {
            // 敗北の場合：0.005から0.4倍
            multiplier = Math.random() * (0.4 - 0.005) + 0.005;
        }
        
        const winAmount = Math.floor(betAmount * multiplier);

        const newCoins = addCoins(userId, winAmount);

        const embed = new EmbedBuilder()
            .setTitle('いんコインギャンブル結果')
            .addFields(
                { name: '賭け金', value: `${betAmount} いんコイン`, inline: true },
                { name: '倍率', value: `${multiplier.toFixed(3)} 倍`, inline: true }, // 小数点以下3桁に表示を増やす
                { name: '獲得/損失', value: `${winAmount - betAmount} いんコイン`, inline: true },
                { name: '現在の残高', value: `${newCoins} いんコイン`, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() });

        // 獲得いんコインが賭け金より多い場合を「あたり」と判定
        if (winAmount > betAmount) {
            embed.setDescription(`あたり！ ${betAmount} いんコインが ${multiplier.toFixed(3)} 倍になり、${winAmount} いんコインを獲得しました！`)
                 .setColor('#00FF00');
        } else {
            embed.setDescription(`はずれ... ${betAmount} いんコインが ${multiplier.toFixed(3)} 倍になり、${winAmount} いんコインになりました。`)
                 .setColor('#FF0000');
        }

        await interaction.reply({ embeds: [embed] });
    },
};
client.commands.set(gamblingCommand.data.name, gamblingCommand);

// gachaCommand は削除されています

const moneyCommand = {
    data: new SlashCommandBuilder()
        .setName('money')
        .setDescription('自分または他のユーザーのいんコイン残高を表示します。')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('残高を確認したいユーザー')
                .setRequired(false)),
    default_member_permissions: null, // @everyoneが使用可能
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const targetUserId = targetUser.id;
        const targetUserCoins = getCoins(targetUserId);

        const embed = new EmbedBuilder()
            .setTitle('いんコイン残高')
            .setColor('#FFFF00')
            .setDescription(`${targetUser.username} さんの現在のいんコイン残高は **${targetUserCoins} いんコイン** です。`)
            .setTimestamp()
            .setFooter({ text: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() });

        await interaction.reply({ embeds: [embed] });
    },
};
client.commands.set(moneyCommand.data.name, moneyCommand);

const WORK_COOLDOWN_MS = 2 * 60 * 60 * 1000;

const workCommand = {
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('2時間に1回、いんコインを稼ぎます。'),
    default_member_permissions: null, // @everyoneが使用可能
    async execute(interaction) {
        const userId = interaction.user.id;
        const now = Date.now();
        const lastWork = userLastWorkTime.get(userId) || 0;

        if (now - lastWork < WORK_COOLDOWN_MS) {
            const timeLeft = WORK_COOLDOWN_MS - (now - lastWork);
            const minutesLeft = Math.ceil(timeLeft / (1000 * 60));
            return interaction.reply({ content: `まだ仕事できません。あと ${minutesLeft} 分待ってください。`, ephemeral: true });
        }

        const earnedAmount = Math.floor(Math.random() * (1500 - 1000 + 1)) + 1000;
        const newCoins = addCoins(userId, earnedAmount);

        userLastWorkTime.set(userId, now);

        const embed = new EmbedBuilder()
            .setTitle('お仕事結果')
            .setColor('#00FF00')
            .setDescription(`お疲れ様です！ ${earnedAmount} いんコインを獲得しました。`)
            .addFields(
                { name: '現在の残高', value: `${newCoins} いんコイン`, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() });

        await interaction.reply({ embeds: [embed] });
    },
};
client.commands.set(workCommand.data.name, workCommand);

const ROB_COOLDOWN_MS = 3 * 60 * 60 * 1000;

const robCommand = {
    data: new SlashCommandBuilder()
        .setName('rob')
        .setDescription('他のユーザーからいんコインを盗みます。')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('盗む相手のユーザー')
                .setRequired(true)),
    default_member_permissions: null, // @everyoneが使用可能
    async execute(interaction) {
        const robberUser = interaction.user;
        const targetUser = interaction.options.getUser('target');
        const now = Date.now();
        const lastRob = userLastRobTime.get(robberUser.id) || 0;

        if (now - lastRob < ROB_COOLDOWN_MS) {
            const timeLeft = ROB_COOLDOWN_MS - (now - lastRob);
            const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
            const minutesLeft = Math.ceil((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            return interaction.reply({ content: `まだ強盗できません。あと ${hoursLeft} 時間 ${minutesLeft} 分待ってください。`, ephemeral: true });
        }

        if (robberUser.id === targetUser.id) {
            return interaction.reply({ content: '自分自身を盗むことはできません！', ephemeral: true });
        }

        if (targetUser.bot) {
            return interaction.reply({ content: 'ボットからいんコインを盗むことはできません！', ephemeral: true });
        }

        const targetCoins = getCoins(targetUser.id);
        const robberCoins = getCoins(robberUser.id);

        if (targetCoins <= 0) {
            return interaction.reply({ content: `${targetUser.username} さんは現在いんコインを持っていません。`, ephemeral: true });
        }

        const successChance = 0.125; // 強盗成功確率を12.5%に変更
        const isSuccess = Math.random() < successChance;

        let embed = new EmbedBuilder()
            .setTitle('強盗結果')
            .setTimestamp()
            .setFooter({ text: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() });

        userLastRobTime.set(robberUser.id, now); // 成功・失敗に関わらずクールダウン適用

        if (isSuccess) {
            // 盗む金額の割合 (50-65%)
            const stolenPercentage = Math.random() * (0.65 - 0.50) + 0.50;
            const stolenAmount = Math.floor(targetCoins * stolenPercentage);

            addCoins(targetUser.id, -stolenAmount); // ターゲットから減らす
            addCoins(robberUser.id, stolenAmount); // 強盗したユーザーに加える

            embed.setDescription(`強盗成功！ ${targetUser.username} さんから **${stolenAmount}** いんコインを盗みました！`)
                 .addFields(
                     { name: `${robberUser.username} の現在の残高`, value: `${getCoins(robberUser.id)} いんコイン`, inline: true },
                     { name: `${targetUser.username} の現在の残高`, value: `${getCoins(targetUser.id)} いんコイン`, inline: true }
                 )
                 .setColor('#00FF00'); // 緑色
        } else {
            // 失敗の場合、罰金として所持金の30-45%を失う
            const penaltyPercentage = Math.random() * (0.45 - 0.30) + 0.30;
            const penaltyAmount = Math.floor(robberCoins * penaltyPercentage);
            const newRobberCoins = addCoins(robberUser.id, -penaltyAmount); // 罰金を減らす

            embed.setDescription(`強盗失敗... ${targetUser.username} さんからいんコインを盗むことができませんでした。
罰金として **${penaltyAmount}** いんコインを失いました。`)
                 .addFields(
                     { name: `${robberUser.username} の現在の残高`, value: `${newRobberCoins} いんコイン`, inline: false }
                 )
                 .setColor('#FF0000'); // 赤色
        }

        await interaction.reply({ embeds: [embed] });
    },
};
client.commands.set(robCommand.data.name, robCommand);

const addMoneyCommand = {
    data: new SlashCommandBuilder()
        .setName('add-money')
        .setDescription('指定したユーザーまたはロールにいんコインを追加します。(管理者のみ)')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('追加するいんコインの金額')
                .setRequired(true)
                .setMinValue(1))
        .addUserOption(option => // ユーザーオプションを再度追加
            option.setName('user')
                .setDescription('いんコインを追加するユーザー')
                .setRequired(false))
        .addRoleOption(option => // ロールオプションを再度追加
            option.setName('role')
                .setDescription('いんコインを追加するロールのメンバー')
                .setRequired(false)),
    default_member_permissions: PermissionsBitField.Flags.Administrator.toString(), // 管理者のみ
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: 'このコマンドを実行するには管理者権限が必要です。', ephemeral: true });
        }

        const amount = interaction.options.getInteger('amount');
        const targetUser = interaction.options.getUser('user');
        const targetRole = interaction.options.getRole('role');

        if (!targetUser && !targetRole) {
            return interaction.reply({ content: 'ユーザーまたはロールのどちらかを指定してください。', ephemeral: true });
        }

        let replyMessage = '';
        if (targetUser) {
            const newCoins = addCoins(targetUser.id, amount);
            replyMessage = `${targetUser.username} に ${amount} いんコインを追加しました。\n現在の残高: ${newCoins} いんコイン`;
        } else if (targetRole) {
            await interaction.guild.members.fetch();
            const members = interaction.guild.members.cache.filter(member => member.roles.cache.has(targetRole.id) && !member.user.bot);
            let addedCount = 0;
            for (const member of members.values()) {
                addCoins(member.id, amount);
                addedCount++;
            }
            replyMessage = `${targetRole.name} ロールの ${addedCount} 人のメンバーに ${amount} いんコインを追加しました。`;
        }

        const embed = new EmbedBuilder()
            .setTitle('いんコイン追加')
            .setColor('#00FF00')
            .setDescription(replyMessage)
            .setTimestamp()
            .setFooter({ text: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() });

        await interaction.reply({ embeds: [embed] });
    },
};
client.commands.set(addMoneyCommand.data.name, addMoneyCommand);

const removeMoneyCommand = {
    data: new SlashCommandBuilder()
        .setName('remove-money')
        .setDescription('指定したユーザーまたはロールからいんコインを削除します。(管理者のみ)')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('削除するいんコインの金額')
                .setRequired(true)
                .setMinValue(1))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('いんコインを削除するユーザー')
                .setRequired(false))
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('いんコインを削除するロールのメンバー')
                .setRequired(false)),
    default_member_permissions: PermissionsBitField.Flags.Administrator.toString(), // 管理者のみ
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: 'このコマンドを実行するには管理者権限が必要です。', ephemeral: true });
        }

        const amount = interaction.options.getInteger('amount');
        const targetUser = interaction.options.getUser('user');
        const targetRole = interaction.options.getRole('role');

        if (!targetUser && !targetRole) {
            return interaction.reply({ content: 'ユーザーまたはロールのどちらかを指定してください。', ephemeral: true });
        }

        let replyMessage = '';
        if (targetUser) {
            const newCoins = addCoins(targetUser.id, -amount);
            replyMessage = `${targetUser.username} から ${amount} いんコインを削除しました。\n現在の残高: ${newCoins} いんコイン`;
        } else if (targetRole) {
            await interaction.guild.members.fetch();
            const members = interaction.guild.members.cache.filter(member => member.roles.cache.has(targetRole.id) && !member.user.bot);
            let removedCount = 0;
            for (const member of members.values()) {
                addCoins(member.id, -amount);
                removedCount++;
            }
            replyMessage = `${targetRole.name} ロールの ${removedCount} 人のメンバーからそれぞれ ${amount} いんコインを削除しました。`;
        }

        const embed = new EmbedBuilder()
            .setTitle('いんコイン削除')
            .setColor('#FF0000')
            .setDescription(replyMessage)
            .setTimestamp()
            .setFooter({ text: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() });

        await interaction.reply({ embeds: [embed] });
    },
};
client.commands.set(removeMoneyCommand.data.name, removeMoneyCommand);

const giveMoneyCommand = {
    data: new SlashCommandBuilder()
        .setName('give-money')
        .setDescription('他のユーザーまたはロールのメンバーにいんコインを渡します。')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('渡すいんコインの金額')
                .setRequired(true)
                .setMinValue(1))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('いんコインを渡すユーザー')
                .setRequired(false))
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('いんコインを渡すロールのメンバー')
                .setRequired(false)),
    default_member_permissions: null, // @everyoneが使用可能
    async execute(interaction) {
        const giverUser = interaction.user;
        const amount = interaction.options.getInteger('amount');
        const targetUser = interaction.options.getUser('user');
        const targetRole = interaction.options.getRole('role');

        if (!targetUser && !targetRole) {
            return interaction.reply({ content: 'ユーザーまたはロールのどちらかを指定してください。', ephemeral: true });
        }

        let affectedUsers = [];
        if (targetUser) {
            if (giverUser.id === targetUser.id) {
                return interaction.reply({ content: '自分自身にいんコインを渡すことはできません！', ephemeral: true });
            }
            if (targetUser.bot) {
                return interaction.reply({ content: 'ボットにいんコインを渡すことはできません！', ephemeral: true });
            }
            affectedUsers.push(targetUser);
        } else if (targetRole) {
            await interaction.guild.members.fetch();
            const members = interaction.guild.members.cache.filter(member =>
                member.roles.cache.has(targetRole.id) && !member.user.bot && member.user.id !== giverUser.id
            );
            affectedUsers = Array.from(members.values()).map(member => member.user);
        }

        if (affectedUsers.length === 0) {
            return interaction.reply({ content: '指定されたユーザーまたはロールのメンバーが見つかりませんでした。', ephemeral: true });
        }

        const totalCost = amount * affectedUsers.length;
        const giverCoins = getCoins(giverUser.id);

        if (giverCoins < totalCost) {
            const embed = new EmbedBuilder()
                .setTitle('いんコイン送金失敗')
                .setColor('#FFD700')
                .setDescription(`いんコインが足りません！${affectedUsers.length}人へ${amount}いんコインを渡すには合計${totalCost}いんコインが必要です。\n現在の残高: ${giverCoins} いんコイン`)
                .setTimestamp()
                .setFooter({ text: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() });
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        addCoins(giverUser.id, -totalCost);

        let replyMessage = '';
        if (targetUser) {
            addCoins(targetUser.id, amount);
            replyMessage = `${targetUser.username} に ${amount} いんコインを渡しました。\n${giverUser.username} の現在の残高: ${getCoins(giverUser.id)} いんコイン\n${targetUser.username} の現在の残高: ${getCoins(targetUser.id)} いんコイン`;
        } else if (targetRole) {
            for (const user of affectedUsers) {
                addCoins(user.id, amount);
            }
            replyMessage = `${targetRole.name} ロールの ${affectedUsers.length} 人のメンバーにそれぞれ ${amount} いんコインを渡しました。\n${giverUser.username} の現在の残高: ${getCoins(giverUser.id)} いんコイン`;
        }

        const embed = new EmbedBuilder()
            .setTitle('いんコイン送金完了')
            .setColor('#00FF00')
            .setDescription(replyMessage)
            .setTimestamp()
            .setFooter({ text: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() });

        await interaction.reply({ embeds: [embed] });
    },
};
client.commands.set(giveMoneyCommand.data.name, giveMoneyCommand);

const channelMoneyCommand = {
    data: new SlashCommandBuilder()
        .setName('channel-money')
        .setDescription('指定したチャンネルでのチャットに報酬を設定します。(管理者のみ)')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('報酬を設定するチャンネル')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('min')
                .setDescription('チャットで獲得できる最低いんコイン')
                .setRequired(true)
                .setMinValue(0))
        .addIntegerOption(option =>
            option.setName('max')
                .setDescription('チャットで獲得できる最大いんコイン')
                .setRequired(true)
                .setMinValue(0)),
    default_member_permissions: PermissionsBitField.Flags.Administrator.toString(), // 管理者のみ
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: 'このコマンドを実行するには管理者権限が必要です。', ephemeral: true });
        }

        const channel = interaction.options.getChannel('channel');
        const minAmount = interaction.options.getInteger('min');
        const maxAmount = interaction.options.getInteger('max');

        if (minAmount > maxAmount) {
            return interaction.reply({ content: '最低金額は最大金額以下である必要があります。', ephemeral: true });
        }

        channelChatRewards.set(channel.id, { min: minAmount, max: maxAmount });

        const embed = new EmbedBuilder()
            .setTitle('チャンネル報酬設定')
            .setColor('#00FF00')
            .setDescription(`${channel.name} でのチャット報酬を ${minAmount} いんコインから ${maxAmount} いんコインに設定しました。`)
            .setTimestamp()
            .setFooter({ text: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() });

        await interaction.reply({ embeds: [embed] });
    },
};
client.commands.set(channelMoneyCommand.data.name, channelMoneyCommand);

// GUILD_ID で指定されたサーバー限定コマンドとして追加
const loadCommand = {
    data: new SlashCommandBuilder()
        .setName('load')
        .setDescription('最新のいんコイン情報を取得します。'),
    default_member_permissions: null, // @everyoneが使用可能
    async execute(interaction) {
        const userId = interaction.user.id;
        const currentCoins = getCoins(userId); // メモリから取得

        const embed = new EmbedBuilder()
            .setTitle('いんコイン情報')
            .setColor('#00FF00')
            .setDescription(`あなたの現在のいんコイン残高は **${currentCoins} いんコイン** です。`)
            .setTimestamp()
            .setFooter({ text: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
client.commands.set(loadCommand.data.name, loadCommand);


// === グローバルコマンド ===

const pingCommand = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Botの応答時間をテストします。'),
    default_member_permissions: null, // @everyoneが使用可能
    async execute(interaction) {
        const ping = client.ws.ping;
        await interaction.reply(`Pong! (${ping}ms)`);
    },
};
client.commands.set(pingCommand.data.name, pingCommand);

const echoCommand = {
    data: new SlashCommandBuilder()
        .setName('echo')
        .setDescription('入力したメッセージを繰り返します。')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('繰り返したいメッセージ')
                .setRequired(true)),
    default_member_permissions: PermissionsBitField.Flags.Administrator.toString(), // 管理者のみ
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: 'このコマンドを実行するには管理者権限が必要です。', ephemeral: true });
        }
        const message = interaction.options.getString('message');
        await interaction.reply({ content: '正常に動作しました。\n(このメッセージはあなただけに表示されています)', ephemeral: true });
        await interaction.channel.send(message);
    },
};
client.commands.set(echoCommand.data.name, echoCommand);

const senddmCommand = {
    data: new SlashCommandBuilder()
        .setName('senddm')
        .setDescription('指定したユーザーにBot経由でDMを送信します。')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('DMを送信するユーザー')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('message')
                .setDescription('送信するメッセージ')
                .setRequired(true)),
    default_member_permissions: PermissionsBitField.Flags.Administrator.toString(), // 管理者のみ
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: 'このコマンドを実行するには管理者権限が必要です。', ephemeral: true });
        }
        const target = interaction.options.getMember('target');
        const message = interaction.options.getString('message');
        
        try {
            await target.send(message);
            await interaction.reply({ content: `<@${target.id}>にDMを送信しました。`, ephemeral: true });
        } catch (error) {
            await interaction.reply({ content: 'DMの送信に失敗しました。', ephemeral: true });
            console.error(error);
        }
    },
};
client.commands.set(senddmCommand.data.name, senddmCommand);

const authPanelCommand = {
    data: new SlashCommandBuilder()
        .setName('auth-panel')
        .setDescription('認証パネルをチャンネルに表示します。')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('認証後に付与するロールを指定します。')
                .setRequired(true)),
    default_member_permissions: PermissionsBitField.Flags.Administrator.toString(), // 管理者のみ
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: 'このコマンドを実行するには管理者権限が必要です。', ephemeral: true });
        }
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
    },
};
client.commands.set(authPanelCommand.data.name, authPanelCommand);

const authCommand = {
    data: new SlashCommandBuilder()
        .setName('auth')
        .setDescription('認証コードを入力して認証を完了します。')
        .addStringOption(option =>
            option.setName('code')
                .setDescription('DMに送信された認証コード')
                .setRequired(true)),
    default_member_permissions: null, // @everyoneが使用可能
    async execute(interaction) {
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
    },
};
client.commands.set(authCommand.data.name, authCommand);

const helpCommand = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Botのコマンド一覧を表示します。'),
    default_member_permissions: null, // @everyoneが使用可能
    async execute(interaction) {
        const helpEmbed = new EmbedBuilder()
            .setTitle('Bot Commands List')
            .setDescription('利用可能なコマンドとその説明です。')
            .setColor('ADFF2F')
            .addFields(
                { name: '/ping', value: 'Botの応答時間をテストします。', inline: false },
                { name: '/echo <message>', value: '入力したメッセージを繰り返します。(管理者のみ)', inline: false },
                { name: '/senddm <target> <message>', value: '指定したユーザーにDMを送信します。(管理者のみ)', inline: false },
                { name: '/auth-panel <role>', value: '認証パネルをチャンネルに表示し、ボタンで認証を開始します。付与するロールの指定は必須です。このコマンドは管理者権限が必要です。', inline: false },
                { name: '/auth <code>', value: 'DMで送信された認証コードを入力して認証を完了します。', inline: false },
                { name: '/ticket-panel <category> <role1> [role2] [role3] [role4]', value: 'チケットパネルをチャンネルに表示し、チケット作成ボタンを設置します。チケットチャンネルは指定されたカテゴリーに作成され、指定したロールに閲覧権限が付与されます。', inline: false },
                { name: '/help', value: 'このコマンド一覧を表示します。', inline: false }
            );
        await interaction.reply({ embeds: [helpEmbed] });
    },
};
client.commands.set(helpCommand.data.name, helpCommand);

const ticketPanelCommand = {
    data: new SlashCommandBuilder()
        .setName('ticket-panel')
        .setDescription('チケットパネルをチャンネルに表示します。')
        .addChannelOption(option =>
            option.setName('category')
                .setDescription('チケットチャンネルを作成するカテゴリー')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildCategory))
        .addRoleOption(option =>
            option.setName('role1')
                .setDescription('チケット閲覧権限を付与する必須ロール')
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('role2')
                .setDescription('チケット閲覧権限を付与する任意ロール')
                .setRequired(false))
        .addRoleOption(option =>
            option.setName('role3')
                .setDescription('チケット閲覧権限を付与する任意ロール')
                .setRequired(false))
        .addRoleOption(option =>
            option.setName('role4')
                .setDescription('チケット閲覧権限を付与する任意ロール')
                .setRequired(false)),
    default_member_permissions: PermissionsBitField.Flags.Administrator.toString(), // 管理者のみ
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: 'このコマンドを実行するには管理者権限が必要です。', ephemeral: true });
        }
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
            .setTitle('チケットが開かれました')
            .setDescription(`サポートが必要な内容をこちらに記入してください。担当者が対応します。
このチャンネルは、あなたと ${rolesMention} のみに表示されています。`);

        await interaction.channel.send({
            content: `${member}`,
            embeds: [ticketEmbed],
            components: [actionRow]
        });
    },
};
client.commands.set(ticketPanelCommand.data.name, ticketPanelCommand);


async function registerCommands() {
    // ギルド（サーバー）限定コマンド (いんコイン関連 + /load)
    const guildCommandsData = [
        gamblingCommand.data.toJSON(),
        // gachaCommand.data.toJSON(), // /gacha コマンドの登録は削除済み
        moneyCommand.data.toJSON(),
        workCommand.data.toJSON(),
        robCommand.data.toJSON(),
        giveMoneyCommand.data.toJSON(),
        addMoneyCommand.data.toJSON(),
        removeMoneyCommand.data.toJSON(),
        channelMoneyCommand.data.toJSON(),
        loadCommand.data.toJSON(), // 新しい /load コマンドを追加
    ];

    // グローバルコマンド (ユーティリティ、認証、チケット関連)
    const globalCommandsData = [
        pingCommand.data.toJSON(),
        echoCommand.data.toJSON(),
        senddmCommand.data.toJSON(),
        authPanelCommand.data.toJSON(),
        authCommand.data.toJSON(),
        helpCommand.data.toJSON(),
        ticketPanelCommand.data.toJSON(),
    ];

    const rest = new REST().setToken(DISCORD_TOKEN);

    try {
        if (GUILD_ID) {
            console.log(`Registering ${guildCommandsData.length} guild-specific commands for guild ${GUILD_ID}.`);
            await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: guildCommandsData });
            console.log('Guild-specific commands successfully registered.');
        } else {
            console.warn('GUILD_ID is not set. Guild-specific commands will not be registered.');
        }

        console.log(`Registering ${globalCommandsData.length} global commands.`);
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: globalCommandsData });
        console.log('Global commands successfully registered.');

    } catch (error) {
        console.error("Failed to register commands:", error);
    }
}

client.once('ready', async () => {
    console.log(`Ready! Logged in as ${client.user.tag}`);
    await registerCommands();
    client.user.setPresence({
        activities: [{
            name: `/help`,
            type: ActivityType.Playing,
        }],
        status: 'online',
    });
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            // default_member_permissions が明示的に設定されている（つまりnullではない）コマンドのみ、権限チェックを行う
            if (command.default_member_permissions && interaction.member && !interaction.member.permissions.has(command.default_member_permissions)) {
                return interaction.reply({ content: 'このコマンドを実行するには管理者権限が必要です。', ephemeral: true });
            }
            // default_member_permissions が null のコマンドは、Discord APIが@everyoneの利用を許可するため、ここでは追加の権限チェックは不要

            await command.execute(interaction);
        } catch (error) {
            console.error(`Error executing command ${interaction.commandName}:`, error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'コマンドの実行中にエラーが発生しました！', ephemeral: true });
            } else {
                await interaction.reply({ content: 'コマンドの実行中にエラーが発生しました！', ephemeral: true });
            }
        }
    } else if (interaction.isButton()) {
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
                const panelConfig = ticketPanels.get(panelId); // メモリ上のマップから設定を取得

                if (!panelConfig) {
                    // ボットの再起動などでパネル情報が失われた場合にここに来る
                    return interaction.editReply({ content: 'このチケットパネルは無効です。ボットが再起動した可能性があります。管理者に連絡して、新しいチケットパネルを作成するよう依頼してください。' });
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
            }
        } catch (error) {
            console.error('ボタン処理中にエラーが発生しました:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'ボタンの実行中にエラーが発生しました。', ephemeral: true });
            } else if (interaction.deferred) {
                await interaction.editReply({ content: 'ボタンの実行中にエラーが発生しました。', ephemeral: true });
            }
        }
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    const channelId = message.channel.id;
    const rewardConfig = channelChatRewards.get(channelId);

    if (rewardConfig) {
        const earnedAmount = Math.floor(Math.random() * (rewardConfig.max - rewardConfig.min + 1)) + rewardConfig.min;
        addCoins(message.author.id, earnedAmount); // メモリに保存
    }
});

client.login(DISCORD_TOKEN);
