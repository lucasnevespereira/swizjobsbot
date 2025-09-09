import { Telegraf, session } from 'telegraf';
import { BotHandlers } from './handlers.js';

export class TelegramBot {
  private bot: Telegraf;

  constructor(token: string) {
    this.bot = new Telegraf(token);
    this.setupMiddleware();
    this.setupCommands();
    this.setupErrorHandling();
  }

  private setupMiddleware() {
    this.bot.use(session({
      defaultSession: () => ({})
    }));
  }

  private setupCommands() {
    this.bot.command('start', BotHandlers.handleStart);
    this.bot.command('register', BotHandlers.handleRegister);
    this.bot.command('config', BotHandlers.handleConfig);
    this.bot.command('status', BotHandlers.handleStatus);
    this.bot.command('pause', BotHandlers.handlePause);
    this.bot.command('help', BotHandlers.handleHelp);

    this.bot.on('text', BotHandlers.handleText);
  }

  private setupErrorHandling() {
    this.bot.catch((err, ctx) => {
      console.error('Bot error:', err);
      ctx.reply('❌ Une erreur est survenue. Veuillez réessayer plus tard.');
    });
  }

  async start() {
    try {
      await this.bot.launch();
      console.log('🤖 Telegram bot started successfully');

      process.once('SIGINT', () => this.stop());
      process.once('SIGTERM', () => this.stop());
    } catch (error) {
      console.error('Failed to start bot:', error);
      throw error;
    }
  }

  async stop() {
    console.log('🛑 Stopping Telegram bot...');
    this.bot.stop('SIGINT');
  }

  async sendMessage(chatId: string, message: string, options?: any) {
    try {
      return await this.bot.telegram.sendMessage(chatId, message, options);
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }
}
