#!/usr/bin/env python3
"""Install the SRS button into the end-4 ii bar, preserving local edits."""
import argparse
from datetime import datetime
from pathlib import Path
import shutil

SOURCE = Path(__file__).resolve().parent
VERTICAL_IMPORT = 'import "../bar/quickshellBar"\n'
VERTICAL_WIDGET = '''            // InsightBook SRS
            QuickshellBarButton {
                Layout.alignment: Qt.AlignHCenter
                Layout.fillHeight: false
            }

'''
IMPORT = 'import "quickshellBar"\n'
WIDGET = '''            // InsightBook SRS
            QuickshellBarButton {
                Layout.alignment: Qt.AlignVCenter
                Layout.fillWidth: false
            }

'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--shell", type=Path, default=Path.home() / ".config/quickshell/ii")
    parser.add_argument("--remove", action="store_true", help="Remove only the button and import; keep session and backups")
    args = parser.parse_args()
    target = args.shell / "modules/ii/bar/BarContent.qml"
    content = target.read_text()
    vertical = args.shell / "modules/ii/verticalBar/VerticalBarContent.qml"
    vertical_content = vertical.read_text()
    legacy_import = IMPORT.replace('quickshellBar', 'insightBook')
    legacy_vertical_import = VERTICAL_IMPORT.replace('quickshellBar', 'insightBook')
    legacy_widget = WIDGET.replace('QuickshellBarButton', 'InsightBookButton')
    legacy_vertical_widget = VERTICAL_WIDGET.replace('QuickshellBarButton', 'InsightBookButton')
    content = content.replace(legacy_import, '').replace(legacy_widget, '')
    vertical_content = vertical_content.replace(legacy_vertical_import, '').replace(legacy_vertical_widget, '')
    if args.remove:
        target.write_text(content.replace(IMPORT, "").replace(WIDGET, ""))
        vertical.write_text(vertical_content.replace(VERTICAL_IMPORT, "").replace(VERTICAL_WIDGET, ""))
        print("Кнопка удалена. Настройки и резервные копии сохранены.")
        return
    if "            SysTray {" not in content:
        raise SystemExit("Не найдена точка установки в BarContent.qml. Файл не изменён.")
    if "            Item {\n                Layout.fillHeight: true" not in vertical_content:
        raise SystemExit("Не найдена точка установки в VerticalBarContent.qml. Файлы не изменены.")
    # Copy dependencies before inserting the button: end-4 watches source changes.
    qml_dir = target.parent / "quickshellBar"
    scripts = args.shell / "scripts/quickshellBar"
    qml_dir.mkdir(parents=True, exist_ok=True)
    scripts.mkdir(parents=True, exist_ok=True)
    # Existing shells reload while files change. Install new types first, then
    # register them before updating components that refer to those types.
    sources = sorted((SOURCE / "qml").iterdir(), key=lambda source: 0 if not (qml_dir / source.name).exists() else 1 if source.name == "qmldir" else 2)
    for source in sources:
        if source.is_file():
            shutil.copy2(source, qml_dir / source.name)
    for name in ("bridge.py", "session.py"):
        shutil.copy2(SOURCE / name, scripts / name)
    if WIDGET not in content:
        backup = scripts / "backups" / datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        backup.mkdir(parents=True)
        shutil.copy2(target, backup / target.name)
        if IMPORT not in content:
            content = IMPORT + content
        content = content.replace("            SysTray {", WIDGET + "            SysTray {", 1)
    if VERTICAL_WIDGET not in vertical_content:
        backup = scripts / "backups" / datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        backup.mkdir(parents=True)
        shutil.copy2(vertical, backup / vertical.name)
        if VERTICAL_IMPORT not in vertical_content:
            vertical_content = VERTICAL_IMPORT + vertical_content
        vertical_content = vertical_content.replace("            Item {\n                Layout.fillHeight: true", VERTICAL_WIDGET + "            Item {\n                Layout.fillHeight: true", 1)
    target.write_text(content)
    vertical.write_text(vertical_content)
    print(f"Установлено в {args.shell}. Кнопка появится после перезагрузки конфигурации Quickshell.")


if __name__ == "__main__":
    main()
