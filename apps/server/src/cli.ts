/// <reference types="bun-types" />

import { eq } from 'drizzle-orm'
import { db, sqlite } from './db'
import * as schema from './db/schema'

const [, , command, username, arg3, arg4] = process.argv

async function main() {
  if (command === 'list') {
    const users = await db.query.users.findMany()
    console.log('--- Список пользователей ---')
    users.forEach(u => console.log(`ID: ${u.id} | Логин: ${u.username} | Роль: ${u.role} | Токены: ${u.usedTokens}/${u.tokenLimit ?? '∞'} | Книги: ${u.bookLimit ?? '∞'} | Создан: ${u.createdAt}`))
    return
  }

  if (command === 'add') {
    const password = arg3
    if (!username || !password) {
      console.error('❌ Использование: bun cli.ts add <username> <password>')
      return
    }
    const existing = await db.query.users.findFirst({ where: eq(schema.users.username, username) })
    if (existing) {
      console.error(`❌ Пользователь ${username} уже существует!`)
      return
    }

    const passwordHash = await Bun.password.hash(password)
    await db.insert(schema.users).values({
      username,
      passwordHash,
      tokenLimit: 1000000,
      bookLimit: 10,
    })
    console.log(`✅ Пользователь ${username} успешно добавлен!`)
    return
  }

  if (command === 'passwd') {
    const password = arg3
    if (!username || !password) {
      console.error('❌ Использование: bun cli.ts passwd <username> <new_password>')
      return
    }
    const existing = await db.query.users.findFirst({ where: eq(schema.users.username, username) })
    if (!existing) {
      console.error(`❌ Пользователь ${username} не найден!`)
      return
    }

    const passwordHash = await Bun.password.hash(password)
    await db.update(schema.users).set({ passwordHash }).where(eq(schema.users.id, existing.id))
    console.log(`✅ Пароль для пользователя ${username} успешно изменен!`)
    return
  }

  if (command === 'limit') {
    if (!username || !arg3) {
      console.error('❌ Использование: bun cli.ts limit <username> <token_limit> [book_limit]')
      console.error('   Пример: bun cli.ts limit admin 10_000_000 50')
      console.error('   Для отключения лимита укажите "null" или "none": bun cli.ts limit admin null null')
      return
    }

    const existing = await db.query.users.findFirst({ where: eq(schema.users.username, username) })
    if (!existing) {
      console.error(`❌ Пользователь ${username} не найден!`)
      return
    }

    const tokenLimit = (arg3 === 'null' || arg3 === 'none') ? null : Number.parseInt(arg3, 10)
    const bookLimit = arg4 === undefined
      ? undefined
      : ((arg4 === 'null' || arg4 === 'none') ? null : Number.parseInt(arg4, 10))

    if (tokenLimit !== null && Number.isNaN(tokenLimit)) {
      console.error('❌ Лимит токенов должен быть числом или "null"/"none"')
      return
    }

    if (bookLimit !== undefined && bookLimit !== null && Number.isNaN(bookLimit)) {
      console.error('❌ Лимит книг должен быть числом или "null"/"none"')
      return
    }

    const updatePayload: any = {}
    if (tokenLimit !== undefined)
      updatePayload.tokenLimit = tokenLimit
    if (bookLimit !== undefined)
      updatePayload.bookLimit = bookLimit

    await db.update(schema.users).set(updatePayload).where(eq(schema.users.id, existing.id))

    console.log(`✅ Лимиты для пользователя ${username} успешно обновлены!`)
    console.log(`   Новый лимит токенов: ${tokenLimit === null ? 'Безлимитно (null)' : tokenLimit.toLocaleString()}`)
    if (bookLimit !== undefined) {
      console.log(`   Новый лимит книг: ${bookLimit === null ? 'Безлимитно (null)' : bookLimit}`)
    }
    return
  }

  console.log(`
Использование CLI:
  bun cli.ts list                              - Показать всех пользователей
  bun cli.ts add <username> <password>         - Добавить нового пользователя
  bun cli.ts passwd <username> <new_password>  - Изменить пароль пользователя
  bun cli.ts limit <username> <tokens> [books] - Изменить лимиты токенов и книг (null/none для отключения)
  `)
}

main().then(() => {
  sqlite.close()
  process.exit(0)
}).catch((err) => {
  console.error('Ошибка:', err)
  sqlite.close()
  process.exit(1)
})
