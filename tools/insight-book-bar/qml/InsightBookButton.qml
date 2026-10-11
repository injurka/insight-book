import QtQuick
import Quickshell
import QtQuick.Layouts
import qs.modules.common
import qs.modules.common.widgets

RippleButton {
    id: root

    property bool opened: false

    implicitWidth: Config.options.bar.vertical ? 36 : label.implicitWidth + 20
    implicitHeight: Config.options.bar.vertical ? 54 : 32
    buttonRadius: Appearance.rounding.full
    toggled: opened
    onClicked: {
        opened = !opened;
        SrsService.paused = opened;
        if (opened && !SrsService.busy)
            SrsService.refresh();

    }

    GridLayout {
        id: label
        columns: Config.options.bar.vertical ? 1 : 2

        anchors.centerIn: parent
        rowSpacing: 2
        columnSpacing: 5

        MaterialSymbol {
            Layout.alignment: Qt.AlignHCenter
            text: "style"
            iconSize: 20
            color: SrsService.count > 0 ? Appearance.colors.colPrimary : Appearance.colors.colOnLayer0
        }

        StyledText {
            Layout.alignment: Qt.AlignHCenter
            text: SrsService.authRequired ? "Вход" : SrsService.error ? "!" : SrsService.ready ? String(SrsService.count) : "…"
            font.pixelSize: Appearance.font.pixelSize.small
        }

    }

    Connections {
        target: SrsService
        function onShowPopup(screenName) {
            if (root.QsWindow.window?.screen?.name === screenName) {
                root.opened = true; SrsService.paused = true;
                if (!SrsService.busy) SrsService.refresh();
            }
        }
    }
    SrsPopup {
        button: root
        visible: root.opened
        onDismissed: {
            root.opened = false;
            SrsService.paused = false;
        }
    }

}
