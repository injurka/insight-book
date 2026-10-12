import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SOURCE = Path(__file__).resolve().parent


class InstallTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.shell = Path(self.temp.name)
        self.bar = self.shell / "modules/ii/bar/BarContent.qml"
        self.vertical = self.shell / "modules/ii/verticalBar/VerticalBarContent.qml"
        self.originals = {
            self.bar: "// Custom bar\nItem {\n            SysTray { }\n}\n",
            self.vertical: "// Custom vertical bar\nItem {\n            Item {\n                Layout.fillHeight: true\n            }\n}\n",
        }
        for path, content in self.originals.items():
            path.parent.mkdir(parents=True)
            path.write_text(content)

    def run_script(self, name, *args):
        return subprocess.run([sys.executable, str(SOURCE / name), "--shell", str(self.shell), *args], capture_output=True, text=True)

    def test_install_twice_and_uninstall_preserves_custom_files(self):
        for _ in range(2):
            result = self.run_script("install.py")
            self.assertEqual(result.returncode, 0, result.stderr)
        for path in self.originals:
            self.assertEqual(path.read_text().count("QuickshellBarButton {"), 1)
        qml = self.bar.parent / "quickshellBar"
        custom = qml / "custom.qml"
        custom.write_text("// User file")
        scripts = self.shell / "scripts/quickshellBar"
        for _ in range(2):
            result = self.run_script("uninstall.py")
            self.assertEqual(result.returncode, 0, result.stderr)
        for path, original in self.originals.items():
            self.assertEqual(path.read_text(), original)
        self.assertEqual(custom.read_text(), "// User file")
        self.assertTrue((scripts / "backups").is_dir())
        self.assertFalse((scripts / "bridge.py").exists())
        self.assertFalse((scripts / "session.py").exists())
        self.assertFalse((qml / "SrsPopup.qml").exists())

    def test_remove_alias(self):
        self.assertEqual(self.run_script("install.py").returncode, 0)
        self.assertEqual(self.run_script("install.py", "--remove").returncode, 0)
        self.assertEqual(self.bar.read_text(), self.originals[self.bar])

    def test_uninstall_missing_shell_is_harmless(self):
        self.bar.unlink()
        self.vertical.unlink()
        self.assertEqual(self.run_script("uninstall.py").returncode, 0)

    def test_modified_widget_stops_before_any_writes(self):
        self.assertEqual(self.run_script("install.py").returncode, 0)
        self.vertical.write_text(self.vertical.read_text().replace("Layout.fillHeight: false", "Layout.fillHeight: true"))
        before = {path: path.read_text() for path in self.originals}
        self.assertNotEqual(self.run_script("uninstall.py").returncode, 0)
        for path, content in before.items():
            self.assertEqual(path.read_text(), content)
        self.assertTrue((self.bar.parent / "quickshellBar/SrsPopup.qml").exists())


if __name__ == "__main__":
    unittest.main()
