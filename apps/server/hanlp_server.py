#!/usr/bin/env python3
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import hanlp

# Загружаем многозадачную модель
print("Загрузка модели HanLP...")
# Эта модель универсальна и содержит токенизацию и POS
mtl = hanlp.load(hanlp.pretrained.mtl.CLOSE_TOK_POS_NER_SRL_DEP_SDP_CON_ELECTRA_SMALL_ZH)
print("Модель загружена.")

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            body = json.loads(post_data.decode('utf-8'))
            
            # Извлекаем тексты
            sentences = []
            is_batch = False
            if 'texts' in body and isinstance(body['texts'], list):
                sentences = body['texts']
                is_batch = True
            elif 'text' in body:
                sentences = [body['text']]

            # Фильтруем пустые строки
            sentences = [s.strip() for s in sentences if s and s.strip()]
            
            if not sentences:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps([]).encode())
                return

            # Выполняем анализ
            # Мы не ограничиваем tasks, чтобы модель вернула всё, что умеет
            doc = mtl(sentences)

            # --- Динамический поиск ключей ---
            # В разных моделях ключи могут называться tok, tok/fine, pos, pos/ctb и т.д.
            
            # Ищем ключи для токенов
            tok_key = None
            for k in ['tok', 'tok/fine', 'tok/coarse']:
                if k in doc:
                    tok_key = k
                    break
            
            # Ищем ключи для частей речи
            pos_key = None
            for k in ['pos', 'pos/ctb', 'pos/pku']:
                if k in doc:
                    pos_key = k
                    break

            if not tok_key or not pos_key:
                raise KeyError(f"Не удалось найти нужные ключи в выводе модели. Доступные ключи: {list(doc.keys())}")

            words_batch = doc[tok_key]
            tags_batch = doc[pos_key]

            # Формируем результат [[[word, pos], ...], [...]]
            results = []
            for words, tags in zip(words_batch, tags_batch):
                results.append(list(zip(words, tags)))

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            # Возвращаем массив массивов, если был запрос 'texts', иначе первый элемент
            response_data = results if is_batch else (results[0] if results else [])
            self.wfile.write(json.dumps(response_data, ensure_ascii=False).encode())

        except Exception as e:
            print(f"Ошибка на сервере: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def log_message(self, format, *args):
        pass

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8765), Handler)
    print("Сервер HanLP готов к работе на порту 8765")
    server.serve_forever()
