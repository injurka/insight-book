import hashlib
import json
from pathlib import Path
import tarfile
import tempfile
import unittest

from release import build


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

    def test_version_cannot_contain_path_segments(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ValueError):
                build(Path(directory), "../../latest")


if __name__ == "__main__":
    unittest.main()
