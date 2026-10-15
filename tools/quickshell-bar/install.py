#!/usr/bin/env python3
"""Install the SRS button into the end-4 ii bar, preserving local edits."""
import argparse
from datetime import datetime
from pathlib import Path
import shutil
import re

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


def uninstall(shell):
    scripts = shell / "scripts/quickshellBar"
    backup = scripts / "backups" / datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    panels = (
        (shell / "modules/ii/bar/BarContent.qml", IMPORT, WIDGET),
        (shell / "modules/ii/verticalBar/VerticalBarContent.qml", VERTICAL_IMPORT, VERTICAL_WIDGET),
    )
    updates = []
    for target, imported, widget in panels:
        if not target.is_file():
            continue
        original = target.read_text()
        content = original
        for block in (imported, widget, imported.replace("quickshellBar", "insightBook"), widget.replace("QuickshellBarButton", "InsightBookButton")):
            content = content.replace(block, "")
        if "QuickshellBarButton" in content or "InsightBookButton" in content:
            raise SystemExit(f"Блок SRS изменён вручную в {target}. Удаление остановлено; файлы не изменены.")
        if content != original:
            updates.append((target, content))
    for target, content in updates:
        backup.mkdir(parents=True, exist_ok=True)
        shutil.copy2(target, backup / target.name)
        target.write_text(content)
    # Delete only files owned by this integration, preserving user files.
    qml_dir = shell / "modules/ii/bar/quickshellBar"
    for source in (SOURCE / "qml").iterdir():
        if source.is_file():
            (qml_dir / source.name).unlink(missing_ok=True)
    for name in ("bridge.py", "session.py"):
        (scripts / name).unlink(missing_ok=True)
    for directory in (qml_dir, scripts):
        if directory.is_dir() and not any(directory.iterdir()):
            directory.rmdir()
    print("Интеграция удалена. Настройки, сессия и резервные копии сохранены.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--shell", type=Path, default=Path.home() / ".config/quickshell/ii")
    parser.add_argument("--remove", action="store_true", help="Uninstall the integration; keep session and backups")
    args = parser.parse_args()
    if args.remove:
        uninstall(args.shell)
        return
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
    # A locally configured button is already an integration; preserve it.
    if content.count("QuickshellBarButton {") > 1 and WIDGET in content:
        content = content.replace(WIDGET, "", 1)
    if vertical_content.count("QuickshellBarButton {") > 1 and VERTICAL_WIDGET in vertical_content:
        vertical_content = vertical_content.replace(VERTICAL_WIDGET, "", 1)
    if not re.search(r"\bQuickshellBarButton\s*\{", content):
        backup = scripts / "backups" / datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        backup.mkdir(parents=True)
        shutil.copy2(target, backup / target.name)
        if IMPORT not in content:
            content = IMPORT + content
        content = content.replace("            SysTray {", WIDGET + "            SysTray {", 1)
    if not re.search(r"\bQuickshellBarButton\s*\{", vertical_content):
        backup = scripts / "backups" / datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        backup.mkdir(parents=True)
        shutil.copy2(vertical, backup / vertical.name)
        if VERTICAL_IMPORT not in vertical_content:
            vertical_content = VERTICAL_IMPORT + vertical_content
        vertical_content = vertical_content.replace("            Item {\n                Layout.fillHeight: true", VERTICAL_WIDGET + "            Item {\n                Layout.fillHeight: true", 1)
    for panel, updated in ((target, content), (vertical, vertical_content)):
        if panel.read_text() != updated:
            backup = scripts / "backups" / datetime.now().strftime("%Y%m%d-%H%M%S-%f")
            backup.mkdir(parents=True)
            shutil.copy2(panel, backup / panel.name)
            panel.write_text(updated)
    print(f"Установлено в {args.shell}. Кнопка появится после перезагрузки конфигурации Quickshell.")


if __name__ == "__main__":
    main()
