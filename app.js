const Telegraf = require('telegraf');
const Composer = require('telegraf/composer');
const session = require('telegraf/session');
const Stage = require('telegraf/stage');
const Markup = require('telegraf/markup');
const WizardScene = require('telegraf/scenes/wizard');

const config = {
	bot_token: '575885527:AAFeCS0Pj6gDntngt4iOp3VjL8P_32ISq74',
}

function defaultResponse (ctx, text, isMarkDown) {
	if (isMarkDown) {
		return ctx.replyWithMarkdown(text, Markup.keyboard([
		['Send bitcoins', 'Receive bitcoins'],
		['Wallet Balance', 'About bot']
		]).oneTime().resize().extra());
	}
	return ctx.reply(text, Markup.keyboard([
		['Send bitcoins', 'Receive bitcoins'],
		['Wallet Balance', 'About bot']
		]).oneTime().resize().extra());
}

function parseBotDataFrom (data) {
	if (data.message !== undefined) {
		return data.message.from;
    } else if (data.update.callback_query !== undefined) {
    	return data.update.callback_query.from;
    } else if (data.update.message !== undefined) {
    	return data.update.message.from;
    }
}

function parseBotDataChat(data) {
	if (data.message !== undefined) {
		return data.message.chat;
    } else if (data.update.callback_query !== undefined) {
    	return data.update.callback_query.message.chat;
    } else if (data.update.message !== undefined) {
    	return data.update.message.chat;
    }
}

function parseBotDataText(data) {
	if (data.message !== undefined) {
		return data.message.text;
    } else if (data.update.callback_query !== undefined) {
    	return data.update.callback_query.message.text;
    } else if (data.update.message !== undefined) {
    	return data.update.message.text;
    }	
}

const welcomeWizard = new WizardScene('welcome-wizard',
	(ctx) => {
		ctx.reply('Choose language', Markup.keyboard([
			['🇺🇸 English', '🇷🇺 Русский']
			]).oneTime().resize().extra());
		return ctx.wizard.next();
	},
	(ctx) => {
		let botDataText = parseBotDataText(ctx);
		if (botDataText !== '🇺🇸 English' && botDataText !== '🇷🇺 Русский') {
			return ctx.reply('Please use buttons');
		}
		if (botDataText === '🇺🇸 English') {
			return defaultResponse(ctx, 'English is selected', false);
		} else {
			return defaultResponse(ctx, 'Выбран русский язык', false);
		}
		return ctx.scene.leave();
	}
)

const bot = new Telegraf(config.bot_token);
const stage = new Stage([welcomeWizard], {
	default: 'welcome-wizard'
});

bot.use(session());
bot.use(stage.middleware());
bot.startPolling();