const Telegraf = require('telegraf');
const Composer = require('telegraf/composer');
const session = require('telegraf/session');
const Stage = require('telegraf/stage');
const Markup = require('telegraf/markup');
const WizardScene = require('telegraf/scenes/wizard');

const bitcoin = require('bitcoinjs-lib');

const config = {
	bot_token: '',
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

function restore_wallet(key) {
	try {
		const keyPair = bitcoin.ECPair.fromWIF(key)
		const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey });
		return address;
	} catch (error) {
		return 'FAILED';
	}
}

const welcomeWizard = new WizardScene('welcome-wizard',
	(ctx, next) => {
		new Promise (function(resolve, reject) {
			ctx.reply('Choose language', Markup.keyboard([
				['English', 'Русский']
				]).oneTime().resize().extra());
			return ctx.wizard.next();
		})
		.catch ((error) => {
            console.log('error');
            return next();
        });
	},
	(ctx, next) => {
		new Promise (function(resolve, reject) {
			let botDataText = parseBotDataText(ctx);
			if (botDataText !== 'English' && botDataText !== 'Русский') {
				return ctx.reply('Use buttons');
			}
			if (botDataText === 'English') {
				ctx.reply('Choose the type of wallet', Markup.keyboard([
					['Create new wallet'],
					['Restore from private key']
					]).oneTime().resize().extra());
				return ctx.wizard.next();
			} else if (botDataText === 'Русский') {
				ctx.reply('Выберите тип кошелька', Markup.keyboard([
					['Создать новый кошелек'],
					['Восстановить из приватного ключа']
					]).oneTime().resize().extra());
				return ctx.wizard.next();
			}
		})
		.catch ((error) => {
            console.log('error');
            return next();
        });
	},
	(ctx, next) => {
		new Promise (function(resolve, reject) {
			let botDataText = parseBotDataText(ctx);
			if (botDataText === 'Create new wallet' || botDataText === 'Создать новый кошелек') {
				const keyPair = bitcoin.ECPair.makeRandom();
				const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey });
				ctx.replyWithMarkdown(`Address - *${address}*\nPrivate key - *${keyPair.toWIF()}*\n\nSave your private key`);
				return ctx.wizard.next();
			} else if (botDataText === 'Restore from private key' || botDataText === 'Восстановить из приватного ключа') {
				ctx.session.isRestoreWallet = true;
				ctx.reply('Enter your private key');
				return ctx.wizard.next();
			} else {
				return ctx.reply('Use buttons');
			}
		})
		.catch ((error) => {
            console.log('error');
            return next();
        });
	},
	(ctx, next) => {
		new Promise (function(resolve, reject) {
			let botDataText = parseBotDataText(ctx);
			if (ctx.session.isRestoreWallet === true) {
				let restoreWalletAddress = restore_wallet(botDataText);
				if (restoreWalletAddress === 'FAILED') {
					return ctx.reply('Incorrect private key');
				} else {
					ctx.reply(restoreWalletAddress)
					//save user
				}
			} else {
				//save user
			}
		})
		.catch ((error) => {
			console.log('error');
		})
	}
)

const bot = new Telegraf(config.bot_token);
const stage = new Stage([welcomeWizard], {
	default: 'welcome-wizard'
});

bot.use(session());
bot.use(stage.middleware());
bot.startPolling();