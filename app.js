const Telegraf = require('telegraf');
const Composer = require('telegraf/composer');
const session = require('telegraf/session');
const Stage = require('telegraf/stage');
const Markup = require('telegraf/markup');
const WizardScene = require('telegraf/scenes/wizard');
const mongoose = require('mongoose');
const https = require('https');

const bitcoin = require('bitcoinjs-lib');

const config = {
	bot_token: '',
}

mongoose.connect('mongodb://localhost:27017/btc-bot', {
	useNewUrlParser: true
});
let db = mongoose.connection;
db.on('error', function() {
    console.log('Error connection to MongoDB');
});
db.once('open', function() {
    console.log('Successfuly connection to MongoDB');
});

let UserSchema = mongoose.Schema({
	_id: mongoose.Schema.Types.ObjectId,
    telegram_id: { type: Number, required: true },
    btc_address: { type: String, required: true},
});

let User = mongoose.model('UserSchema', UserSchema);

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
			let botDataFrom = parseBotDataFrom(ctx);
			User.find({telegram_id: botDataFrom.id})
			.exec()
			.then(mongo_result => {
				if (mongo_result.length === 0) {
					ctx.reply('Choose language', Markup.keyboard([
						['English', 'Русский']
						]).oneTime().resize().extra());
					return ctx.wizard.next();
				} else {
					return defaultResponse(ctx, 'Hello!', false);
				}
			})
			.catch(mongo_error => {
				return ctx.reply('Bot error');
			})
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
				ctx.session.address = address;
				ctx.replyWithMarkdown(`Address - *${address}*\nPrivate key - *${keyPair.toWIF()}*\n\nSave your private key`,
					Markup.keyboard([
						['Okay'],
						]).oneTime().resize().extra());
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
			let botDataFrom = parseBotDataFrom(ctx);
			if (ctx.session.isRestoreWallet === true) {
				let restoreWalletAddress = restore_wallet(botDataText);
				if (restoreWalletAddress === 'FAILED') {
					return ctx.reply('Incorrect private key');
				} else {
					const newUser = new User({
						_id: new mongoose.Types.ObjectId(),
						telegram_id: Number(botDataFrom.id),
						btc_address: restoreWalletAddress,
					});
					newUser
					.save()
					.then(mongo_result => {
						defaultResponse(ctx, 'Your account has been created', false);
						ctx.session.restoreWalletAddress = null;
						ctx.session.address = null;
						return ctx.scene.leave();
					})
					.catch(mongo_error => {
						return ctx.reply('Bot error');
					})
				}
			} else {
				const newUser = new User({
					_id: new mongoose.Types.ObjectId(),
					telegram_id: Number(botDataFrom.id),
					btc_address: ctx.session.address,
				});
				newUser
				.save()
				.then(mongo_result => {
					defaultResponse(ctx, 'Your account has been created', false);
					ctx.session.restoreWalletAddress = null;
					ctx.session.address = null;
					return ctx.scene.leave();
				})
				.catch(mongo_error => {
					return ctx.reply('Bot error');
				})
			}
		})
		.catch ((error) => {
			return ctx.reply('Bot error');
		})
	}
)

welcomeWizard.hears('Wallet Balance', (ctx, next) => {
	new Promise (function(resolve, reject) {
		let botDataFrom = parseBotDataFrom(ctx);
		let botDataChat = parseBotDataChat(ctx);

		if (botDataChat.type !== 'private') {
			return false;
		}

		User.find({ telegram_id: botDataFrom.id })
		.exec()
		.then(mongo_result => {
			if (mongo_result.length !== 0) {
				https.get(`https://blockchain.info/rawaddr/${mongo_result[0].btc_address}`, (resp) => {
					let data = '';

					resp.on('data', (chunk) => {
						data += chunk;
					});

					resp.on('end', () => {
						let userBalance = JSON.parse(data);

						if (userBalance.final_balance === 0) {
							return defaultResponse(ctx, `Your balance - 0 BTC`, false);
						} else {
							user_balance = Number(userBalance.final_balance) / Number(100000000);
							return defaultResponse(ctx, `Your balance - ${user_balance} BTC`, false);
						}
					}).on("error", (err) => {
						return ctx.reply('Bot error');
					});
				});
			} else {
				return ctx.wizard.back();
			}
		})
		.catch(mongo_error => {

		})
	})
	.catch ((error) => {
		return ctx.reply('Bot error');
	})
});

const bot = new Telegraf(config.bot_token);
const stage = new Stage([welcomeWizard], {
	default: 'welcome-wizard'
});

bot.use(session());
bot.use(stage.middleware());
bot.startPolling();