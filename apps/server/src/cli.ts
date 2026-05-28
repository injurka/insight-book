/// <reference types="bun-types" />

import { eq } from 'drizzle-orm'
import { db, sqlite } from './db'
import * as schema from './db/schema'

const [, , command, username, password] = process.argv

async function main() {
  if (command === 'list') {
    const users = await db.query.users.findMany()
    console.log('--- Список пользователей ---')
    users.forEach(u => console.log(`ID: ${u.id} | Логин: ${u.username} | Создан: ${u.createdAt}`))
    return
  }

  if (command === 'add') {
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
    await db.insert(schema.users).values({ username, passwordHash })
    console.log(`✅ Пользователь ${username} успешно добавлен!`)
    return
  }

  if (command === 'passwd') {
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

  console.log(`
Использование CLI:
  bun cli.ts list                              - Показать всех пользователей
  bun cli.ts add <username> <password>         - Добавить нового пользователя
  bun cli.ts passwd <username> <new_password>  - Изменить пароль пользователя
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
