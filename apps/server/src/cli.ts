/// <reference types="bun-types" />

import { eq } from 'drizzle-orm'
import { db, sqlite } from './db'
import * as schema from './db/schema'
import { logger } from './utils/logger'

const [, , command, username, arg3, arg4] = process.argv

async function main() {
  if (command === 'list') {
    const users = await db.query.users.findMany()
    logger.info('--- Список пользователей ---')
    users.forEach(u => logger.info(`ID: ${u.id} | Логин: ${u.username} | Роль: ${u.role} | Тариф: ${u.subscriptionTier || 'free'} | Токены: ${u.usedTokens}/${u.tokenLimit ?? '∞'} | Книги: ${u.bookLimit ?? '∞'} | Создан: ${u.createdAt}`))
    return
  }

  if (command === 'tier') {
    const tier = arg3 as 'free' | 'base' | 'advanced' | 'premium'
    if (!username || !tier) {
      logger.error('❌ Использование: bun cli.ts tier <username> <free|base|advanced|premium>')
      return
    }

    const validTiers = ['free', 'base', 'advanced', 'premium']
    if (!validTiers.includes(tier)) {
      logger.error(`❌ Варианты тарифа: ${validTiers.join(', ')}`)
      return
    }

    const existing = await db.query.users.findFirst({ where: eq(schema.users.username, username) })
    if (!existing) {
      logger.error(`❌ Пользователь ${username} не найден!`)
      return
    }

    const tierLimits: Record<string, { tokenLimit: number | null, bookLimit: number | null }> = {
      free: { tokenLimit: 100_000, bookLimit: 1 },
      base: { tokenLimit: 250_000, bookLimit: 2 },
      advanced: { tokenLimit: 700_000, bookLimit: 4 },
      premium: { tokenLimit: 2_000_000, bookLimit: 10 },
    }

    const limits = tierLimits[tier]
    await db.update(schema.users).set({
      subscriptionTier: tier,
      tokenLimit: limits.tokenLimit,
      bookLimit: limits.bookLimit,
    }).where(eq(schema.users.id, existing.id))

    logger.info(`✅ Подписка для пользователя ${username} изменена на "${tier}"!`)
    logger.info(`   Обновлены лимиты: токены = ${limits.tokenLimit?.toLocaleString()}, книги = ${limits.bookLimit}`)
    return
  }

  if (command === 'add') {
    const password = arg3
    if (!username || !password) {
      logger.error('❌ Использование: bun cli.ts add <username> <password>')
      return
    }
    const existing = await db.query.users.findFirst({ where: eq(schema.users.username, username) })
    if (existing) {
      logger.error(`❌ Пользователь ${username} уже существует!`)
      return
    }

    const passwordHash = await Bun.password.hash(password)
    await db.insert(schema.users).values({
      username,
      passwordHash,
    })
    logger.info(`✅ Пользователь ${username} успешно добавлен!`)
    return
  }

  if (command === 'passwd') {
    const password = arg3
    if (!username || !password) {
      logger.error('❌ Использование: bun cli.ts passwd <username> <new_password>')
      return
    }
    const existing = await db.query.users.findFirst({ where: eq(schema.users.username, username) })
    if (!existing) {
      logger.error(`❌ Пользователь ${username} не найден!`)
      return
    }

    const passwordHash = await Bun.password.hash(password)
    await db.update(schema.users).set({ passwordHash }).where(eq(schema.users.id, existing.id))
    logger.info(`✅ Пароль для пользователя ${username} успешно изменен!`)
    return
  }

  if (command === 'limit') {
    if (!username || !arg3) {
      logger.error('❌ Использование: bun cli.ts limit <username> <token_limit> [book_limit]')
      logger.error('   Пример: bun cli.ts limit admin 10_000_000 50')
      logger.error('   Для отключения лимита укажите "null" или "none": bun cli.ts limit admin null null')
      return
    }

    const existing = await db.query.users.findFirst({ where: eq(schema.users.username, username) })
    if (!existing) {
      logger.error(`❌ Пользователь ${username} не найден!`)
      return
    }

    const tokenLimit = (arg3 === 'null' || arg3 === 'none') ? null : Number.parseInt(arg3, 10)
    const bookLimit = arg4 === undefined
      ? undefined
      : ((arg4 === 'null' || arg4 === 'none') ? null : Number.parseInt(arg4, 10))

    if (tokenLimit !== null && Number.isNaN(tokenLimit)) {
      logger.error('❌ Лимит токенов должен быть числом или "null"/"none"')
      return
    }

    if (bookLimit !== undefined && bookLimit !== null && Number.isNaN(bookLimit)) {
      logger.error('❌ Лимит книг должен быть числом или "null"/"none"')
      return
    }

    const updatePayload: Partial<typeof schema.users.$inferInsert> = {}
    if (tokenLimit !== undefined)
      updatePayload.tokenLimit = tokenLimit
    if (bookLimit !== undefined)
      updatePayload.bookLimit = bookLimit

    await db.update(schema.users).set(updatePayload).where(eq(schema.users.id, existing.id))

    logger.info(`✅ Лимиты для пользователя ${username} успешно обновлены!`)
    logger.info(`   Новый лимит токенов: ${tokenLimit === null ? 'Безлимитно (null)' : tokenLimit.toLocaleString()}`)
    if (bookLimit !== undefined) {
      logger.info(`   Новый лимит книг: ${bookLimit === null ? 'Безлимитно (null)' : bookLimit}`)
    }
    return
  }

  if (command === 'role') {
    const role = arg3
    if (!username || !role) {
      logger.error('❌ Использование: bun cli.ts role <username> <role>')
      return
    }

    const existing = await db.query.users.findFirst({ where: eq(schema.users.username, username) })
    if (!existing) {
      logger.error(`❌ Пользователь ${username} не найден!`)
      return
    }

    await db.update(schema.users).set({ role }).where(eq(schema.users.id, existing.id))
    logger.info(`✅ Роль для пользователя ${username} успешно изменена на ${role}!`)
    return
  }

  if (command === 'del' || command === 'delete' || command === 'rm') {
    if (!username) {
      logger.error('❌ Использование: bun cli.ts delete <username>')
      return
    }

    const existing = await db.query.users.findFirst({ where: eq(schema.users.username, username) })
    if (!existing) {
      logger.error(`❌ Пользователь ${username} не найден!`)
      return
    }

    await db.delete(schema.users).where(eq(schema.users.id, existing.id))
    logger.info(`✅ Пользователь ${username} успешно удален!`)
    return
  }

  logger.info(`
Использование CLI:
  bun cli.ts list                              - Показать всех пользователей
  bun cli.ts add <username> <password>         - Добавить нового пользователя
  bun cli.ts passwd <username> <new_password>  - Изменить пароль пользователя
  bun cli.ts limit <username> <tokens> [books] - Изменить лимиты токенов и книг (null/none для отключения)
  bun cli.ts role <username> <role>            - Изменить роль пользователя
  bun cli.ts delete <username>                 - Удалить пользователя
  `)
}

main().then(() => {
  sqlite.close()
  process.exit(0)
}).catch((err) => {
  logger.error(err, 'Ошибка:')
  sqlite.close()
  process.exit(1)
})
