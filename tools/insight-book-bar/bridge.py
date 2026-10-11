#!/usr/bin/env python3
"""InsightBook bar transport. One JSON command on stdin, one safe JSON result."""
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

DEFAULT_URL = "https://insight-book-api.limited-dissolve.ru"
CONFIG_DIR = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config")) / "insight-book-bar"
SETTINGS = CONFIG_DIR / "settings.json"


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


class NoRedirect(HTTPRedirectHandler):
    # Never forward account credentials to a redirected host.
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def load_settings():
    defaults = {"url": DEFAULT_URL, "language": "all", "targetLang": "ru", "deckId": "all", "token": ""}
    if SETTINGS.exists():
        defaults.update(json.loads(SETTINGS.read_text()))
    return defaults


def save_settings(settings):
    CONFIG_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(CONFIG_DIR, 0o700)
    fd, name = tempfile.mkstemp(dir=CONFIG_DIR, prefix=".settings-")
    try:
        with os.fdopen(fd, "w") as stream:
            json.dump(settings, stream, ensure_ascii=False)
        os.replace(name, SETTINGS)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def public_settings(settings):
    return {key: settings[key] for key in ("url", "language", "targetLang", "deckId")}


def configure(settings, values):
    url = str(values.get("url", settings["url"])).strip().rstrip("/")
    parts = urlsplit(url)
    local = parts.hostname in ("localhost", "127.0.0.1", "::1")
    if not parts.hostname or parts.username or parts.password or parts.query or parts.fragment:
        raise ValueError("Укажи URL бека без логина, параметров и фрагмента.")
    if parts.scheme != "https" and not (parts.scheme == "http" and local):
        raise ValueError("Для удалённого бека нужен HTTPS.")
    if url != settings["url"]:
        settings["token"] = ""
        settings.pop("oauthSession", None)
    settings["url"] = url
    for key in ("language", "targetLang", "deckId"):
        settings[key] = str(values.get(key, settings[key])).strip() or ("ru" if key == "targetLang" else "all")
    return settings


def api(settings, path, payload=None, query=None):
    url = settings["url"] + "/api/" + path
    if query:
        url += "?" + urlencode(query)
    headers = {"Accept": "application/json", "Cache-Control": "no-cache"}
    if settings.get("token"):
        headers["Authorization"] = "Bearer " + settings["token"]
    data = None if payload is None else json.dumps(payload).encode()
    if data is not None:
        headers["Content-Type"] = "application/json"
    try:
        with build_opener(NoRedirect()).open(Request(url, data=data, headers=headers), timeout=12) as response:
            return json.load(response)
    except HTTPError as error:
        messages = {401: "Войди в аккаунт InsightBook.", 403: "Нет доступа к аккаунту.",
                    429: "Слишком много запросов. Попробуй через минуту."}
        raise ApiError(error.code, messages.get(error.code, f"Ошибка бека: HTTP {error.code}.")) from None
    except (URLError, TimeoutError, OSError):
        raise ApiError(0, "Бек недоступен. Проверь соединение и адрес сервера.") from None
    except (ValueError, UnicodeError):
        raise ApiError(0, "Сервер вернул ответ, который не похож на API InsightBook.") from None


def filters(settings):
    return {key: settings[key] for key in ("language", "targetLang", "deckId")}


def legacy_count(settings):
    # Compatibility with a deployed server that predates /review/count.
    # /dictionary includes all words and deckIds, unlike the capped review batch.
    words = api(settings, "dictionary/", query={"targetLang": settings["targetLang"]})
    if not isinstance(words, list):
        raise ValueError("Некорректный ответ словаря.")
    now = datetime.now(timezone.utc)
    total = 0
    for word in words:
        if settings["language"] != "all" and word.get("language") != settings["language"]:
            continue
        deck = settings["deckId"]
        if deck == "none" and word.get("deckIds"):
            continue
        if deck not in ("all", "none") and int(deck) not in word.get("deckIds", []):
            continue
        due = datetime.fromisoformat(word["due"].replace("Z", "+00:00"))
        if due.tzinfo is None:
            due = due.replace(tzinfo=timezone.utc)
        total += due <= now
    return total


def queue(settings):
    words = api(settings, "dictionary/review", query={**filters(settings), "mode": "srs"})
    if not isinstance(words, list) or any(not isinstance(w, dict) or "id" not in w or "word" not in w for w in words):
        raise ValueError("Некорректная очередь повторения.")
    try:
        count = api(settings, "dictionary/review/count", query=filters(settings))["count"]
        if not isinstance(count, int) or count < 0:
            raise ValueError("Некорректный счётчик очереди.")
    except ApiError as error:
        if error.status != 404:
            raise
        count = legacy_count(settings)
    # Send only the fields displayed by the desktop widget.
    cards = [{key: word.get(key) for key in ("id", "word", "transcription", "translation")} for word in words]
    return {"cards": cards, "count": count}


def metadata(settings):
    decks = api(settings, "dictionary/decks", query={"targetLang": settings["targetLang"]})
    if not isinstance(decks, list):
        raise ValueError("Некорректный список колод.")
    return {"decks": [{key: deck.get(key) for key in ("id", "name", "language")} for deck in decks]}


def dispatch(command):
    settings = load_settings()
    action = command.get("action", "refresh")
    result = {}
    if action in ("configure", "login", "oauth-start"):
        configure(settings, command)
    if action == "configure":
        save_settings(settings)
    elif action == "login":
        token = command.get("token", "").strip()
        if not token:
            response = api(settings, "auth/login", {"login": command.get("login", ""), "password": command.get("password", "")})
            token = response.get("token")
        if not isinstance(token, str) or not token:
            raise ValueError("Сервер не вернул токен авторизации.")
        settings["token"] = token
        api(settings, "auth/me")
        settings.pop("oauthSession", None)
        save_settings(settings)
    elif action == "logout":
        settings["token"] = ""
        settings.pop("oauthSession", None)
        save_settings(settings)
        return {"ok": True, "config": public_settings(settings), "loggedOut": True}
    elif action == "oauth-start":
        settings["oauthSession"] = secrets.token_urlsafe(32)
        save_settings(settings)
        url = settings["url"] + "/api/auth/yandex?" + urlencode({"session_id": settings["oauthSession"]})
        subprocess.Popen(["xdg-open", url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return {"ok": True, "config": public_settings(settings), "oauthPending": True}
    elif action == "oauth-poll":
        session = settings.get("oauthSession")
        if not session:
            return {"ok": True, "oauthPending": False}
        response = api(settings, "auth/status", query={"session_id": session})
        if response.get("status") == "pending":
            return {"ok": True, "oauthPending": True}
        if not response.get("token"):
            raise ValueError("Не удалось войти через Яндекс.")
        settings["token"] = response["token"]
        settings.pop("oauthSession", None)
        save_settings(settings)
    elif action == "review":
        word_id, grade = command.get("wordId"), command.get("grade")
        if type(word_id) is not int or word_id < 1 or type(grade) is not int or grade not in (1, 2, 3, 4):
            raise ValueError("Некорректная оценка карточки.")
        response = api(settings, "dictionary/review", {"wordId": word_id, "grade": grade})
        if response.get("success") is not True:
            raise ValueError("Бек не подтвердил сохранение оценки.")
        # The UI removes the card only after this acknowledgement, even if refresh fails.
        result["reviewedId"] = word_id
    elif action not in ("refresh", "metadata"):
        raise ValueError("Неизвестная команда.")
    result.update({"ok": True, "config": public_settings(settings)})
    try:
        result.update(metadata(settings) if action == "metadata" else queue(settings))
    except (ApiError, ValueError, KeyError, TypeError) as error:
        result.update({"ok": False, "error": str(error), "authRequired": isinstance(error, ApiError) and error.status == 401})
    return result


def main():
    try:
        command = json.loads(sys.stdin.readline())
        result = dispatch(command)
    except (ApiError, ValueError, KeyError, TypeError, OSError) as error:
        result = {"ok": False, "error": str(error) if isinstance(error, (ApiError, ValueError)) else "Не удалось прочитать настройки виджета.",
                  "authRequired": isinstance(error, ApiError) and error.status == 401}
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
