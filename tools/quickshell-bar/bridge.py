#!/usr/bin/env python3
"""InsightBook bar transport. One JSON command on stdin, one safe JSON result."""
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import tempfile
import base64
import binascii
import random
import session
from html.parser import HTMLParser
from html import escape
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

DEFAULT_URL = "https://insight-book-api.limited-dissolve.ru"
CONFIG_DIR = session.CONFIG_DIR
SETTINGS = session.SETTINGS
CONFIG_KEYS = ("url", "language", "targetLang", "deckId", "difficulty", "modes")



class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


class NoRedirect(HTTPRedirectHandler):
    # Never forward account credentials to a redirected host.
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def load_settings():
    return session.load({"url": DEFAULT_URL, "language": "all", "targetLang": "ru", "deckId": "all", "difficulty": "all", "modes": ["standard"]})


save_settings = session.save


def public_settings(settings):
    return {key: settings[key] for key in CONFIG_KEYS}


def is_mp3_audio(audio):
    def has_mpeg_frame_at(offset):
        if len(audio) < offset + 4:
            return False

        header = int.from_bytes(audio[offset:offset + 4], "big")
        version = (header >> 19) & 0b11
        layer = (header >> 17) & 0b11
        bitrate_index = (header >> 12) & 0b1111
        sample_rate_index = (header >> 10) & 0b11
        return (header & 0xFFE00000) == 0xFFE00000 and version != 0b01 and layer != 0 \
            and bitrate_index not in (0, 0b1111) and sample_rate_index != 0b11

    if has_mpeg_frame_at(0):
        return True
    if len(audio) < 10 or audio[:3] != b"ID3":
        return False

    tag_size = (audio[6] << 21) | (audio[7] << 14) | (audio[8] << 7) | audio[9]
    return has_mpeg_frame_at(10 + tag_size)


def configure(settings, values):
    url = str(values.get("url", settings["url"])).strip().rstrip("/")
    parts = urlsplit(url)
    local = parts.hostname in ("localhost", "127.0.0.1", "::1")
    if not parts.hostname or parts.username or parts.password or parts.query or parts.fragment:
        raise ValueError("Укажи URL бека без логина, параметров и фрагмента.")
    if parts.scheme != "https" and not (parts.scheme == "http" and local):
        raise ValueError("Для удалённого бека нужен HTTPS.")
    if url != settings["url"]:
        session.clear(settings)
    settings["url"] = url
    for key in ("language", "targetLang", "deckId", "difficulty"):
        settings[key] = str(values.get(key, settings[key])).strip() or ("ru" if key == "targetLang" else "all")
    if "modes" in values:
        modes = values["modes"]
        if not isinstance(modes, list) or not modes or any(m not in ("standard", "typing", "choice", "choice-reverse", "audio") for m in modes):
            raise ValueError("Выбери хотя бы один режим тренировки.")
        settings["modes"] = list(dict.fromkeys(modes))
    return settings


def raw_api(settings, path, payload=None, query=None):
    url = settings["url"] + "/api/" + path
    if query:
        url += "?" + urlencode(query)
    headers = {"Accept": "application/json", "Cache-Control": "no-cache"}
    if settings.get("accessToken"):
        headers["Authorization"] = "Bearer " + settings["accessToken"]
    data = None if payload is None else json.dumps(payload).encode()
    if data is not None:
        headers["Content-Type"] = "application/json"
    try:
        timeout = 65 if path in ("dictionary/chat", "dictionary/generate-examples") else 45 if path == "tts" else 12
        with build_opener(NoRedirect()).open(Request(url, data=data, headers=headers), timeout=timeout) as response:
            return json.load(response)
    except HTTPError as error:
        messages = {401: "Войди в аккаунт InsightBook.", 403: "Нет доступа к аккаунту.",
                    429: "Слишком много запросов. Попробуй через минуту."}
        raise ApiError(error.code, messages.get(error.code, f"Ошибка бека: HTTP {error.code}.")) from None
    except (URLError, TimeoutError, OSError):
        raise ApiError(0, "Бек недоступен. Проверь соединение и адрес сервера.") from None
    except (ValueError, UnicodeError):
        raise ApiError(0, "Сервер вернул ответ, который не похож на API InsightBook.") from None


def api(settings, path, payload=None, query=None):
    return session.request(settings, raw_api, ApiError, path, payload, query)


def filters(settings):
    return {key: settings[key] for key in ("language", "targetLang", "deckId", "difficulty")}


def legacy_queue(settings):
    # Compatibility with a deployed server that predates /review/count.
    # /dictionary includes all words and deckIds, unlike the capped review batch.
    words = api(settings, "dictionary/", query={"targetLang": settings["targetLang"]})
    if not isinstance(words, list):
        raise ValueError("Некорректный ответ словаря.")
    now = datetime.now(timezone.utc)
    selected = []
    for word in words:
        if settings["language"] != "all" and word.get("language") != settings["language"]:
            continue
        decks = settings["deckId"].split(",")
        if "all" not in decks and not (("none" in decks and not word.get("deckIds")) or any(str(d) in decks for d in word.get("deckIds", []))):
            continue
        levels = settings["difficulty"].split(",")
        if "all" not in levels and not (("none" in levels and not word.get("difficulty")) or word.get("difficulty") in levels):
            continue
        due = datetime.fromisoformat(word["due"].replace("Z", "+00:00"))
        if due.tzinfo is None:
            due = due.replace(tzinfo=timezone.utc)
        if due <= now:
            selected.append(word)
    return sorted(selected, key=lambda w: w["due"])


class NoteText(HTMLParser):
    def __init__(self, rich=False):
        super().__init__()
        self.rich = rich
        self.parts = []
        self.hidden = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.hidden += 1
        if tag in ("br", "p", "div", "li") and not self.hidden:
            self.parts.append("\n")
        if self.rich and tag in ("b", "strong", "i", "em", "u") and not self.hidden:
            self.parts.append("<" + tag + ">")

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.hidden = max(0, self.hidden - 1)
        if tag in ("p", "div", "li") and not self.hidden:
            self.parts.append("\n")
        if self.rich and tag in ("b", "strong", "i", "em", "u") and not self.hidden:
            self.parts.append("</" + tag + ">")

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(escape(data) if self.rich else data)


def note_text(value, rich=False):
    parser = NoteText(rich)
    parser.feed(value if isinstance(value, str) else "")
    lines = [line.strip() for line in "".join(parser.parts).splitlines() if line.strip()]
    return ("<br>" if rich else "\n").join(lines)[:4000]


def public_card(word):
    card = {key: word.get(key) for key in ("id", "word", "transcription", "translation", "language", "difficulty", "due", "stability", "difficultyFsrs", "scheduledDays", "reps", "lapses", "state", "lastReview", "learningSteps")}
    card.update({key: note_text(word.get(key), rich=True) for key in ("grammarNote", "vocabularyNote", "notes")})
    encounters = word.get("encounters") or []
    card["sentence"] = note_text(encounters[0].get("sentence")) if encounters and isinstance(encounters[0], dict) else ""
    return card


def queue(settings):
    try:
        count = api(settings, "dictionary/review/count", query=filters(settings))["count"]
        if not isinstance(count, int) or count < 0:
            raise ValueError("Некорректный счётчик очереди.")
        words = api(settings, "dictionary/review", query={**filters(settings), "mode": "srs"})
    except ApiError as error:
        if error.status != 404:
            raise
        words = legacy_queue(settings)
        count = len(words)
        words = words[:50]
    if not isinstance(words, list) or any(not isinstance(w, dict) or "id" not in w or "word" not in w for w in words):
        raise ValueError("Некорректная очередь повторения.")
    # Send only the fields displayed by the desktop widget.
    cards = [public_card(word) for word in words]
    return {"cards": cards, "count": count}


def metadata(settings):
    decks = api(settings, "dictionary/decks", query={"targetLang": settings["targetLang"]})
    words = api(settings, "dictionary/", query={"targetLang": settings["targetLang"]})
    if not isinstance(decks, list) or not isinstance(words, list):
        raise ValueError("Некорректный ответ словаря.")
    pool = [w for w in words if w.get("translation")]
    random.shuffle(pool)
    groups = {}
    for word in words:
        if not word.get("difficulty"):
            continue
        for deck in ["all"] + [str(d) for d in word.get("deckIds", []) or ["none"]]:
            groups.setdefault(deck, {}).setdefault(word["language"], set()).add(word["difficulty"])
    levels = {deck: {lang: sorted(values) for lang, values in languages.items()} for deck, languages in groups.items()}
    return {"decks": [{key: deck.get(key) for key in ("id", "name", "language")} for deck in decks],
            "languages": sorted({w["language"] for w in words}),
            "levels": levels,
            "pool": [{key: w.get(key) for key in ("id", "word", "translation", "language")} for w in pool[:300]]}


def account(settings):
    response = api(settings, "auth/me")
    user = response.get("user")
    if not user:
        raise ApiError(401, "Войди в свой аккаунт.")
    return {"authenticated": True, "user": {"username": user.get("username") or user.get("email") or "Пользователь"},
            "renewable": bool(settings.get("refreshToken"))}


def dispatch(command):
    settings = load_settings()
    action = command.get("action", "bootstrap")
    result = {"ok": True}
    if action in ("connect", "configure", "login", "oauth-start"):
        configure(settings, command)
    if action == "connect":
        settings["signedOut"] = False
        save_settings(settings)
    elif action == "configure":
        save_settings(settings)
    elif action == "login":
        payload = {"login": command.get("login", ""), "password": command.get("password", "")}
        try:
            response = raw_api(settings, "auth/session/login", payload)
        except ApiError as error:
            if error.status != 404:
                raise
            response = raw_api(settings, "auth/login", payload)
        session.accept(settings, response)
        settings.pop("oauthSession", None)
        save_settings(settings)
    elif action == "logout":
        warning = ""
        if settings.get("refreshToken"):
            try:
                raw_api(settings, "auth/session/logout", {"refreshToken": settings["refreshToken"]})
            except ApiError:
                warning = "Вход на этом устройстве сброшен. Сервер был недоступен для завершения сессии."
        session.clear(settings)
        settings["signedOut"] = True
        save_settings(settings)
        return {"ok": True, "config": public_settings(settings), "authenticated": False, "loggedOut": True, "warning": warning}
    elif action == "oauth-start":
        settings["oauthSession"] = secrets.token_urlsafe(32)
        save_settings(settings)
        url = settings["url"] + "/api/auth/yandex?" + urlencode({"session_id": settings["oauthSession"], "session": "desktop"})
        subprocess.Popen(["xdg-open", url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return {"ok": True, "config": public_settings(settings), "oauthPending": True}
    elif action == "oauth-poll":
        response = raw_api(settings, "auth/status", query={"session_id": settings.get("oauthSession", "")})
        if response.get("status") == "pending":
            return {"ok": True, "oauthPending": True}
        session.accept(settings, response)
        settings.pop("oauthSession", None)
        save_settings(settings)
        result["oauthPending"] = False
    elif action == "statistics":
        response = api(settings, "activity/stats")
        if not isinstance(response, dict) or not isinstance(response.get("heatmap"), list):
            raise ValueError("Сервер вернул некорректную статистику.")
        return {"ok": True, "statistics": {key: response.get(key, [] if key in ("heatmap", "difficulties") else 0) for key in ("heatmap", "learnedWords", "readPages", "difficulties")}}
    elif action == "review":
        word_id, grade = command.get("wordId"), command.get("grade")
        if type(word_id) is not int or word_id < 1 or type(grade) is not int or grade not in (1, 2, 3, 4):
            raise ValueError("Некорректная оценка карточки.")
        response = api(settings, "dictionary/review", {"wordId": word_id, "grade": grade})
        if response.get("success") is not True:
            raise ValueError("Бек не подтвердил сохранение оценки.")
        result["reviewedId"] = word_id
    elif action == "audio":
        text = command.get("text", "")
        if not isinstance(text, str) or not 0 < len(text) <= 4096:
            raise ValueError("Некорректный текст озвучки.")
        response = api(settings, "tts", {"text": text, "voice": "alloy"})
        if not isinstance(response, dict) or not isinstance(response.get("audioBase64"), str):
            raise ValueError("Сервер вернул некорректную озвучку.")
        try:
            audio = base64.b64decode(response["audioBase64"], validate=True)
        except (binascii.Error, ValueError):
            raise ValueError("Сервер вернул некорректную озвучку.") from None
        mime_type = response.get("mimeType")
        if mime_type not in (None, "audio/mpeg"):
            raise ValueError("Сервер вернул неподдерживаемый формат озвучки.")
        if not is_mp3_audio(audio):
            raise ValueError("Сервер вернул данные, которые не являются MP3.")

        fd, filename = tempfile.mkstemp(prefix="srs-audio-", suffix=".mp3", dir=CONFIG_DIR)
        with os.fdopen(fd, "wb") as stream:
            stream.write(audio)
        for old in CONFIG_DIR.glob("srs-audio-*"):
            if str(old) != filename:
                old.unlink(missing_ok=True)
        return {"ok": True, "audioUrl": Path(filename).as_uri()}
    elif action == "ai-chat":
        word, language = command.get("word", ""), command.get("language", "")
        prompt = command.get("prompt", "")
        if not isinstance(word, str) or not 0 < len(word) <= 512 or not isinstance(language, str) or len(language) > 32:
            raise ValueError("Некорректное слово или язык для ИИ-чата.")
        if not isinstance(prompt, str) or not 0 < len(prompt.strip()) <= 2000:
            raise ValueError("Напиши вопрос длиной до 2000 символов.")
        response = api(settings, "dictionary/chat", {
            "word": word, "language": language or "en",
            "uiLanguage": "ru", "userPromptText": prompt.strip(),
        })
        if not isinstance(response, dict) or not isinstance(response.get("response"), str):
            raise ValueError("Некорректный ответ ИИ-чата.")
        result["aiResult"] = response["response"]
    elif action == "ai-examples":
        word, language = command.get("word", ""), command.get("language", "")
        if not isinstance(word, str) or not 0 < len(word) <= 512 or not isinstance(language, str) or len(language) > 32:
            raise ValueError("Некорректное слово или язык для ИИ-подсказки.")
        response = api(settings, "dictionary/generate-examples", {
            "word": word, "language": language or "en",
        }, query={"targetLang": settings["targetLang"]})
        if not isinstance(response, dict):
            raise ValueError("Некорректный ответ ИИ-подсказки.")
        result["aiResult"] = response
    elif action not in ("bootstrap", "refresh", "metadata"):
        raise ValueError("Неизвестная команда.")
    result["config"] = public_settings(settings)
    try:
        if settings.get("signedOut"):
            raise ApiError(401, "Войди в свой аккаунт.")
        if action in ("bootstrap", "connect", "login", "oauth-poll"):
            result.update(account(settings))
        result.update(metadata(settings) if action in ("bootstrap", "connect", "login", "oauth-poll", "metadata", "configure") else {})
        if action in ("configure", "refresh", "review"):
            result.update(queue(settings))
    except (ApiError, ValueError, KeyError, TypeError) as error:
        result.update({"ok": False, "error": str(error), "authRequired": isinstance(error, ApiError) and error.status == 401})
        if result["authRequired"]:
            result["authenticated"] = False
    return result


def main():
    try:
        command = json.loads(sys.stdin.readline())
        with session.locked():
            result = dispatch(command)
    except (ApiError, ValueError, KeyError, TypeError, OSError) as error:
        result = {"ok": False, "error": str(error) if isinstance(error, (ApiError, ValueError)) else "Не удалось прочитать настройки виджета.",
                  "authRequired": isinstance(error, ApiError) and error.status == 401}
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
