"""Exercise the real bridge protocol against a local HTTP API without user data."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

HERE = Path(__file__).resolve().parent


class BridgeTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.words = [{"id": i, "word": f"word-{i}", "language": "en", "deckIds": [1], "due": "2000-01-01T00:00:00Z"} for i in range(1, 62)]
        self.session_supported = False
        self.access = "test-token"
        self.refresh = "refresh-token-for-tests-000000000"
        self.refreshes = 0
        self.reject_once = False
        self.count_supported = False
        self.fail_refresh = False
        self.redirect_login = False
        self.stolen = False
        case = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def reply(self, body, status=200):
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(body).encode())

            def do_GET(self):
                path = urlsplit(self.path).path
                if path == "/stolen":
                    case.stolen = True
                if path == "/api/auth/status":
                    self.reply({"status": "success", "accessToken": case.access, "refreshToken": case.refresh, "expiresIn": 900})
                    return
                if case.reject_once:
                    case.reject_once = False
                    self.reply({}, 401)
                    return
                if self.headers.get("Authorization") != "Bearer " + case.access:
                    self.reply({}, 401)
                elif path == "/api/auth/me":
                    self.reply({"user": {"id": 1, "username": "Test"}, "mode": "multi"})
                elif path == "/api/dictionary/review/count":
                    self.reply({"count": len(case.words)} if case.count_supported else {}, 200 if case.count_supported else 404)
                elif path == "/api/dictionary/review":
                    self.reply(case.words[:50], 503 if case.fail_refresh else 200)
                elif path == "/api/dictionary/":
                    self.reply(case.words)
                elif path == "/api/dictionary/decks":
                    self.reply([{"id": 1, "name": "English", "language": "en"}])
                else:
                    self.reply({}, 404)

            def do_POST(self):
                body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                if self.path == "/api/auth/session/login":
                    if not case.session_supported:
                        self.reply({}, 404)
                    else:
                        self.reply({"accessToken": case.access, "refreshToken": case.refresh, "expiresIn": 900})
                elif self.path == "/api/auth/session/refresh":
                    if body.get("refreshToken") != case.refresh:
                        self.reply({}, 401)
                    else:
                        case.refreshes += 1
                        case.access = "test-token-" + str(case.refreshes)
                        case.refresh = "refresh-token-for-tests-" + str(case.refreshes)
                        self.reply({"accessToken": case.access, "refreshToken": case.refresh, "expiresIn": 900})
                elif self.path == "/api/auth/session/logout":
                    case.refresh = "revoked"
                    self.reply({"success": True})
                elif self.path == "/api/auth/login":
                    if case.redirect_login:
                        self.send_response(307)
                        self.send_header("Location", "/stolen")
                        self.end_headers()
                    elif body == {"login": "test", "password": "private-password"}:
                        self.reply({"token": "test-token"})
                    else:
                        self.reply({}, 401)
                elif self.path == "/api/dictionary/review" and self.headers.get("Authorization") == "Bearer " + case.access:
                    case.words = [w for w in case.words if w["id"] != body["wordId"]]
                    self.reply({"success": True})
                else:
                    self.reply({}, 404)

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp.cleanup()

    def call(self, **command):
        result = subprocess.run(["python3", str(HERE / "bridge.py")], input=json.dumps(command) + "\n", text=True,
                                capture_output=True, env={**os.environ, "XDG_CONFIG_HOME": self.temp.name}, timeout=30)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn("test-token", result.stdout)
        self.assertNotIn("refresh-token-for-tests", result.stdout)
        self.assertNotIn("private-password", result.stdout)
        return json.loads(result.stdout)

    def login(self):
        return self.call(action="login", url=self.url, login="test", password="private-password")

    def test_login_private_session_fallback_count_and_review(self):
        result = self.login()
        self.assertTrue(result["ok"])
        self.assertNotIn("cards", result)
        result = self.call(action="configure")
        self.assertEqual(result["count"], 61)
        self.assertEqual(len(result["cards"]), 50)
        path = Path(self.temp.name) / "quickshell-bar/settings.json"
        self.assertEqual(path.stat().st_mode & 0o777, 0o600)
        self.assertEqual(path.parent.stat().st_mode & 0o777, 0o700)
        self.assertNotIn("private-password", path.read_text())
        result = self.call(action="review", wordId=1, grade=3)
        self.assertTrue(result["ok"])
        self.assertEqual(result["reviewedId"], 1)
        self.assertEqual(result["count"], 60)
        self.assertEqual(result["cards"][0]["id"], 2)
        self.assertTrue(self.call(action="logout")["loggedOut"])
        self.assertTrue(self.call(action="refresh")["authRequired"])

    def test_new_count_endpoint_and_deck_filters(self):
        self.count_supported = True
        self.login()
        self.assertEqual(self.call(action="configure")["count"], 61)
        self.count_supported = False
        self.assertEqual(self.call(action="configure", deckId="none")["count"], 0)
        self.assertEqual(self.call(action="configure", deckId="1", language="en")["count"], 61)
        self.assertEqual(self.call(action="configure", language="zh")["count"], 0)

    def test_acknowledgement_survives_failed_refresh(self):
        self.login()
        self.count_supported = True
        self.fail_refresh = True
        result = self.call(action="review", wordId=1, grade=1)
        self.assertFalse(result["ok"])
        self.assertEqual(result["reviewedId"], 1)
        self.assertEqual(len(self.words), 60)

    def test_refreshes_proactively_and_after_401_and_revokes(self):
        self.session_supported = True
        self.assertTrue(self.login()["renewable"])
        path = Path(self.temp.name) / "quickshell-bar/settings.json"
        saved = json.loads(path.read_text())
        saved["accessExpiresAt"] = 0
        path.write_text(json.dumps(saved))
        self.assertTrue(self.call(action="refresh")["ok"])
        self.assertEqual(self.refreshes, 1)
        self.reject_once = True
        self.assertTrue(self.call(action="refresh")["ok"])
        self.assertEqual(self.refreshes, 2)
        self.assertTrue(self.call(action="logout")["loggedOut"])
        self.assertEqual(self.refresh, "revoked")
        self.assertNotIn("refreshToken", json.loads(path.read_text()))

    def test_oauth_pair_and_difficulty_are_preserved(self):
        self.login()
        self.words[0]["difficulty"] = "A1"
        self.assertEqual(self.call(action="configure", difficulty="A1")["count"], 1)
        path = Path(self.temp.name) / "quickshell-bar/settings.json"
        saved = json.loads(path.read_text())
        saved["oauthSession"] = "fixture-session"
        path.write_text(json.dumps(saved))
        result = self.call(action="oauth-poll")
        self.assertTrue(result["ok"])
        self.assertTrue(result["renewable"])
        self.assertFalse(result["oauthPending"])

    def test_multiple_decks_and_difficulties(self):
        self.words = [
            {"id": i, "word": str(i), "language": "en", "deckIds": decks, "difficulty": level, "due": "2000-01-01T00:00:00Z"}
            for i, decks, level in [(1, [1], "A1"), (2, [2], "A2"), (3, [], None), (4, [3], "B1")]
        ]
        self.login()
        result = self.call(action="configure", deckId="1,2,none", difficulty="A1,A2,none")
        self.assertEqual(result["count"], 3)
        self.assertEqual([w["id"] for w in result["cards"]], [1, 2, 3])
        result = self.call(action="configure", deckId="2", difficulty="A1,none")
        self.assertEqual(result["count"], 0)

    def test_card_notes_preserve_formatting_and_context_is_plain_text(self):
        self.words[0].update(grammarNote="<p>Порядок слов</p><script>hidden()</script>",
                             vocabularyNote='<b class="term">Учёба</b> &amp; практика<br><i>Пример</i><img src="https://example.invalid/pixel">', notes="Заметка",
                             encounters=[{"sentence": "<p>我每天学习。</p>", "privateField": "not-public"}])
        self.login()
        result = self.call(action="configure")
        card = result["cards"][0]
        self.assertEqual(card["grammarNote"], "Порядок слов")
        self.assertEqual(card["vocabularyNote"], "<b>Учёба</b> &amp; практика<br><i>Пример</i>")
        self.assertEqual(card["notes"], "Заметка")
        self.assertEqual(card["sentence"], "我每天学习。")
        self.assertNotIn("encounters", card)
        self.assertNotIn("hidden()", json.dumps(card))

    def test_rejects_invalid_grade_insecure_host_and_redirects(self):
        self.login()
        self.assertFalse(self.call(action="review", wordId=1, grade=9)["ok"])
        self.assertEqual(len(self.words), 61)
        self.assertFalse(self.call(action="login", url="http://remote.example", login="test", password="private-password")["ok"])
        self.redirect_login = True
        self.assertFalse(self.login()["ok"])
        self.assertFalse(self.stolen)


if __name__ == "__main__":
    unittest.main()
