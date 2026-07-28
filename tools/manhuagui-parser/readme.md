## @injurka/insight-book-manhuagui-parser

Стильный и надежный CLI-парсер для скачивания манги с сайта [manhuagui.com](https://www.manhuagui.com) в формат CBZ для Insight Book (или просто в папки с изображениями).

### Особенности:

- **@clack/prompts**: красивый пошаговый интерактивный интерфейс в терминале.
- **Анти-Детект**: мимикрия под десктопный Chrome и обход блокировок (Cloudflare/мобильные редиректы).
- **Отказоустойчивость**: автоматические повторные попытки (retries) при скачивании (борьба с 502/503 ошибками CDN).

### Использование

```bash
bun --cwd ./tools/manhuagui-parser run start
# или сразу с указанием URL
bun --cwd ./tools/manhuagui-parser run start https://www.manhuagui.com/comic/19430/
```
