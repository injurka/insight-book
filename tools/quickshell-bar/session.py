"""Private session persistence and automatic access-token renewal."""
from contextlib import contextmanager
import fcntl
import json
import os
from pathlib import Path
import tempfile
import time

CONFIG_DIR = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config")) / "quickshell-bar"
SETTINGS = CONFIG_DIR / "settings.json"
LEGACY = CONFIG_DIR.parent / "insight-book-bar" / "settings.json"


def private_dir():
    CONFIG_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(CONFIG_DIR, 0o700)


@contextmanager
def locked():
    private_dir()
    fd = os.open(CONFIG_DIR / ".session.lock", os.O_CREAT | os.O_RDWR, 0o600)
    with os.fdopen(fd, "w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        yield


def load(defaults):
    source = SETTINGS if SETTINGS.exists() else LEGACY
    if source.exists():
        defaults.update(json.loads(source.read_text()))
    if "token" in defaults:
        defaults["accessToken"] = defaults.pop("token")
    if source == LEGACY and source.exists():
        save(defaults)
        source.unlink()
    return defaults


def save(settings):
    private_dir()
    fd, name = tempfile.mkstemp(dir=CONFIG_DIR, prefix=".settings-")
    try:
        with os.fdopen(fd, "w") as stream:
            json.dump(settings, stream, ensure_ascii=False)
        os.replace(name, SETTINGS)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def accept(settings, response):
    access = response.get("accessToken") or response.get("token")
    if not isinstance(access, str) or not access:
        raise ValueError("Сервер не вернул сессию авторизации.")
    settings.update(accessToken=access, refreshToken=response.get("refreshToken", ""),
                    accessExpiresAt=time.time() + response.get("expiresIn", 30 * 24 * 3600), signedOut=False)
    save(settings)


def clear(settings):
    for key in ("accessToken", "refreshToken", "oauthSession"):
        settings.pop(key, None)
    settings["accessExpiresAt"] = 0


def renew(settings, request):
    result = request(settings, "auth/session/refresh", {"refreshToken": settings["refreshToken"]})
    accept(settings, result)


def request(settings, raw_request, error_type, path, payload=None, query=None):
    renewable = bool(settings.get("refreshToken")) and path not in ("auth/session/login", "auth/login", "auth/session/refresh", "auth/session/logout")
    if renewable and settings.get("accessExpiresAt", 0) <= time.time() + 30:
        renew(settings, raw_request)
    try:
        return raw_request(settings, path, payload, query)
    except error_type as error:
        if error.status != 401 or not renewable:
            raise
        renew(settings, raw_request)
        return raw_request(settings, path, payload, query)
