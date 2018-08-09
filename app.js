const Telegraf = require('telegraf');
const Extra = require('telegraf/extra');
const Markup = require('telegraf/markup');

const config = {
	bot_token: '',
}

const bot = new Telegraf(config.bot_token)

bot.start((ctx) => {
	ctx.reply('Welcome!');
});

bot.startPolling();