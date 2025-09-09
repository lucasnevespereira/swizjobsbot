import { Context } from 'telegraf';
import { db } from '../database/connection.js';
import { users, jobSearches } from '../database/schema.js';
import { eq } from 'drizzle-orm';
import { MESSAGES } from '../utils/messages.js';

interface BotContext extends Context {
  session?: {
    step?: string;
    data?: any;
  };
}

const messages = MESSAGES.fr;

export class BotHandlers {
  static async handleStart(ctx: BotContext) {
    const chatId = ctx.chat?.id.toString();
    const username = ctx.from?.username ? `@${ctx.from.username}` : 'unknown';
    const firstName = ctx.from?.first_name || 'Unknown';

    if (!chatId) return;

    console.log(`👋 [User ${chatId}] ${firstName} (${username}) used /start command`);

    try {
      const existingUser = await db.select().from(users).where(eq(users.telegramChatId, chatId)).limit(1);

      if (existingUser.length > 0) {
        console.log(`🔄 [User ${chatId}] Existing user reactivated`);
        await db.update(users)
          .set({ active: true, updatedAt: new Date() })
          .where(eq(users.telegramChatId, chatId));

        await ctx.reply(messages.commands.resume);
      } else {
        console.log(`✨ [User ${chatId}] New user welcomed`);
        await ctx.reply(messages.welcome);
      }
    } catch (error) {
      console.error(`❌ [User ${chatId}] Start command error:`, error);
      await ctx.reply(messages.errors.databaseError);
    }
  }

  static async handleRegister(ctx: BotContext) {
    const chatId = ctx.chat?.id.toString();
    const username = ctx.from?.username ? `@${ctx.from.username}` : 'unknown';
    const firstName = ctx.from?.first_name || 'Unknown';

    if (!chatId) return;

    console.log(`📝 [User ${chatId}] ${firstName} (${username}) attempting registration`);

    try {
      const existingUser = await db.select().from(users).where(eq(users.telegramChatId, chatId)).limit(1);

      if (existingUser.length > 0) {
        console.log(`⚠️  [User ${chatId}] Registration attempt - user already exists`);
        await ctx.reply(messages.registration.alreadyRegistered);
        return;
      }

      await db.insert(users).values({
        telegramChatId: chatId,
        username: username,
        firstName: firstName,
        createdAt: new Date(),
        updatedAt: new Date(),
        language: 'fr',
        active: true
      });

      console.log(`✅ [User ${chatId}] Successfully registered new user: ${firstName} (${username})`);
      await ctx.reply(messages.registration.success);
    } catch (error) {
      console.error(`❌ [User ${chatId}] Registration error:`, error);
      await ctx.reply(messages.errors.databaseError);
    }
  }

  static async handleConfig(ctx: BotContext) {
    const chatId = ctx.chat?.id.toString();
    if (!chatId) return;

    try {
      const user = await db.select().from(users).where(eq(users.telegramChatId, chatId)).limit(1);

      if (user.length === 0) {
        await ctx.reply(messages.errors.notRegistered);
        return;
      }

      ctx.session = { step: 'keywords' };
      await ctx.reply(messages.config.keywords);
    } catch (error) {
      console.error('Config command error:', error);
      await ctx.reply(messages.errors.databaseError);
    }
  }

  static async handleStatus(ctx: BotContext) {
    const chatId = ctx.chat?.id.toString();
    if (!chatId) return;

    try {
      const user = await db.select().from(users).where(eq(users.telegramChatId, chatId)).limit(1);

      if (user.length === 0) {
        await ctx.reply(messages.status.notRegistered);
        return;
      }

      const searches = await db.select().from(jobSearches).where(eq(jobSearches.userId, user[0]!.id));

      let statusText = user[0]!.active ? messages.status.active : messages.status.paused;

      if (searches.length > 0) {
        statusText += `\n\n📋 Vos critères de recherche:`;
        searches.forEach((search) => {
          statusText += `\n\nMots-clés: ${search.keywords.join(', ')}`;
          statusText += `\nLieux: ${search.locations.join(', ')}`;
          statusText += `\nStatut: ${search.active ? '✅ Actif' : '⏸️ Suspendu'}`;
        });
      } else {
        statusText += '\n\n⚠️ Aucun critère configuré. Utilisez /config';
      }

      await ctx.reply(statusText);
    } catch (error) {
      console.error('Status command error:', error);
      await ctx.reply(messages.errors.databaseError);
    }
  }

  static async handlePause(ctx: BotContext) {
    const chatId = ctx.chat?.id.toString();
    if (!chatId) return;

    try {
      const user = await db.select().from(users).where(eq(users.telegramChatId, chatId)).limit(1);

      if (user.length === 0) {
        await ctx.reply(messages.errors.notRegistered);
        return;
      }

      await db.update(users)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(users.telegramChatId, chatId));

      await ctx.reply(messages.commands.pause);
    } catch (error) {
      console.error('Pause command error:', error);
      await ctx.reply(messages.errors.databaseError);
    }
  }

  static async handleHelp(ctx: BotContext) {
    await ctx.reply(messages.commands.help);
  }

  static async handleText(ctx: BotContext) {
    const chatId = ctx.chat?.id.toString();
    const text = (ctx.message && 'text' in ctx.message) ? ctx.message.text : undefined;

    if (!chatId || !text) return;

    if (!ctx.session?.step) return;

    try {
      const user = await db.select().from(users).where(eq(users.telegramChatId, chatId)).limit(1);
      if (user.length === 0) {
        await ctx.reply(messages.errors.notRegistered);
        return;
      }

      switch (ctx.session.step) {
        case 'keywords': {
          const keywords = text.split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 0);
          if (keywords.length === 0) {
            await ctx.reply(messages.errors.invalidInput);
            return;
          }

          ctx.session.data = { keywords };
          ctx.session.step = 'locations';
          await ctx.reply(messages.config.locations);
          break;
        }

        case 'locations': {
          const locations = text.split(',').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
          if (locations.length === 0) {
            await ctx.reply(messages.errors.invalidInput);
            return;
          }

          ctx.session.data = { ...ctx.session.data, locations };

          // Save the job search configuration
          const existingSearch = await db.select().from(jobSearches).where(eq(jobSearches.userId, user[0]!.id)).limit(1);

          if (existingSearch.length > 0) {
            console.log(`🔧 [User ${chatId}] Updated job search criteria: keywords=[${ctx.session.data.keywords.join(', ')}], locations=[${ctx.session.data.locations.join(', ')}]`);
            await db.update(jobSearches)
              .set({
                keywords: ctx.session.data.keywords,
                locations: ctx.session.data.locations,
                updatedAt: new Date()
              })
              .where(eq(jobSearches.userId, user[0]!.id));
          } else {
            console.log(`🆕 [User ${chatId}] Created new job search criteria: keywords=[${ctx.session.data.keywords.join(', ')}], locations=[${ctx.session.data.locations.join(', ')}]`);
            await db.insert(jobSearches).values({
              userId: user[0]!.id,
              keywords: ctx.session.data.keywords,
              locations: ctx.session.data.locations,
              maxAgeDays: 7,
              active: true
            });
          }

          delete ctx.session.step;
          delete ctx.session.data;
          await ctx.reply(messages.config.success);
          break;
        }

        default:
          await ctx.reply(messages.errors.invalidInput);
      }
    } catch (error) {
      console.error('Text handler error:', error);
      await ctx.reply(messages.errors.databaseError);
    }
  }

}
