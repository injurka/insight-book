import QtQuick
import Quickshell
import qs.modules.common
import qs.modules.common.widgets

RippleButton {
    id: root

    property bool opened: false

    implicitWidth: Config.options.bar.vertical ? 36 : 40
    implicitHeight: Config.options.bar.vertical ? 36 : 32
    buttonRadius: Appearance.rounding.full
    toggled: opened
    colBackgroundToggled: Appearance.colors.colPrimaryContainer
    colBackgroundToggledHover: Appearance.colors.colPrimaryContainerHover
    colRippleToggled: Appearance.colors.colPrimaryContainerActive
    onClicked: {
        opened = !opened;
        SrsService.paused = opened;
        if (opened && !SrsService.busy)
            SrsService.refresh();

    }

    MaterialSymbol {
        anchors.centerIn: parent
        text: "style"
        iconSize: 20
        color: root.opened ? Appearance.colors.colOnPrimaryContainer : SrsService.stage === "training" && SrsService.count > 0 ? Appearance.colors.colPrimary : Appearance.colors.colOnLayer0
    }

    Connections {
        target: SrsService
        function onShowStatistics(screenName) {
            if (root.QsWindow.window?.screen?.name === screenName) {
                root.opened = true;
                SrsService.paused = true;
                popup.statisticsVisible = true;
                SrsService.request({action: "statistics"});
            }
        }
        function onShowPopup(screenName) {
            if (root.QsWindow.window?.screen?.name === screenName) {
                root.opened = true; SrsService.paused = true;
                if (!SrsService.busy) SrsService.refresh();
            }
        }
    }
    SrsPopup {
        id: popup
        button: root
        opened: root.opened
        targetScreen: root.QsWindow.window?.screen
        visible: root.opened && !popup.detached
        onDismissed: {
            root.opened = false;
            SrsService.paused = false;
        }
    }

}
