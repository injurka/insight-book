import hashlib
import json
import os
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

from release import build, publish


class ReleaseTests(unittest.TestCase):
    def test_standalone_archive_has_only_distribution_files(self):
        with tempfile.TemporaryDirectory() as directory:
            archive, checksum, manifest = build(Path(directory), "v1.2.3")
            digest = hashlib.sha256(archive.read_bytes()).hexdigest()
            self.assertEqual(checksum.read_text().split()[0], digest)
            self.assertEqual(json.loads(manifest.read_text())["sha256"], digest)
            with tarfile.open(archive) as bundle:
                names = bundle.getnames()
                for required in ("install.py", "uninstall.py", "bridge.py", "session.py", "qml/qmldir", "qml/SrsText.qml", "qml/SrsCardViewport.qml"):
                    self.assertIn("quickshell-bar/" + required, names)
                self.assertFalse(any("__pycache__" in name or "settings.json" in name or "test_" in name or ".env" in name for name in names))
                self.assertEqual(bundle.extractfile("quickshell-bar/VERSION").read(), b"v1.2.3\n")

    def test_publish_uses_bunny_api_even_with_s3_endpoint(self):
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / "quickshell-bar.tar.gz"
            archive.write_bytes(b"archive")
            env = {
                "S3_ENDPOINT": "https://s3.example.invalid",
                "S3_BUCKET": "insight-book",
                "S3_SECRET_KEY": "storage-password",
                "VITE_CDN_URL": "https://cdn.example.invalid",
            }
            with patch.dict(os.environ, env, clear=True), patch("release.urlopen") as open_url:
                open_url.return_value.__enter__.return_value.status = 201
                publish((archive,), "v3.34.8")

            self.assertEqual(open_url.call_count, 2)
            requests = [call.args[0] for call in open_url.call_args_list]
            self.assertEqual(
                [request.full_url for request in requests],
                [
                    "https://storage.bunnycdn.com/insight-book/quickshell-bar/v3.34.8/quickshell-bar.tar.gz",
                    "https://storage.bunnycdn.com/insight-book/quickshell-bar/latest/quickshell-bar.tar.gz",
                ],
            )
            self.assertTrue(all(request.get_method() == "PUT" for request in requests))
            self.assertTrue(all(request.get_header("Accesskey") == "storage-password" for request in requests))
            self.assertTrue(all(request.data == b"archive" for request in requests))

    def test_version_cannot_contain_path_segments(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ValueError):
                build(Path(directory), "../../latest")


if __name__ == "__main__":
    unittest.main()
