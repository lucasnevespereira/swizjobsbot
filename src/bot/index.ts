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
      console.log('🚀 Validating Telegram bot token...');
      
      // Test bot token first
      try {
        const botInfo = await this.bot.telegram.getMe();
        console.log(`✅ Bot token valid. Bot name: ${botInfo.first_name} (@${botInfo.username})`);
      } catch (tokenError) {
        console.error('❌ Invalid Telegram bot token:', tokenError);
        throw new Error('Invalid Telegram bot token');
      }

      console.log('🚀 Launching Telegram bot with polling...');
      
      // Use polling mode explicitly (more reliable for VPS)
      const launchPromise = this.bot.launch({
        dropPendingUpdates: true
      });
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Bot launch timeout after 30 seconds')), 30000);
      });

      await Promise.race([launchPromise, timeoutPromise]);
      console.log('🤖 Telegram bot started successfully');
    } catch (error) {
      console.error('❌ Failed to start Telegram bot:', error);
      console.error('❌ Error details:', error instanceof Error ? error.message : 'Unknown error');
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
