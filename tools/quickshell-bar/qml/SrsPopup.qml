import QtQuick
import QtQuick.Layouts
import Quickshell
import Quickshell.Wayland
import qs.services
import qs.modules.common
import qs.modules.common.widgets

PanelWindow {
    id: root

    required property Item button
    property var targetScreen

    signal dismissed()

    screen: targetScreen || Quickshell.screens[0]
    exclusiveZone: 0
    WlrLayershell.namespace: "quickshell:srs"
    WlrLayershell.keyboardFocus: visible ? WlrKeyboardFocus.OnDemand : WlrKeyboardFocus.None
    anchors {
        top: !Config.options.bar.bottom || Config.options.bar.vertical
        bottom: Config.options.bar.bottom && !Config.options.bar.vertical
        left: Config.options.bar.vertical && !Config.options.bar.bottom
        right: !Config.options.bar.vertical || Config.options.bar.bottom
    }
    margins {
        top: Appearance.sizes.hyprlandGapsOut
        bottom: Appearance.sizes.hyprlandGapsOut
        left: Appearance.sizes.hyprlandGapsOut
        right: Appearance.sizes.hyprlandGapsOut
    }
    readonly property real fitScale: Math.min(1, ((root.screen?.height || 1080) - 40) / (content.implicitHeight + 40))
    implicitWidth: 500 * fitScale
    implicitHeight: (content.implicitHeight + 40) * fitScale
    color: "transparent"
    onVisibleChanged: {
        if (visible) {
            GlobalFocusGrab.addDismissable(root);
            keyboard.forceActiveFocus();
        } else {
            GlobalFocusGrab.removeDismissable(root);
            dismissed();
        }
    }
    Connections {
        target: GlobalFocusGrab
        function onDismissed() { if (root.visible) root.dismissed(); }
    }

    Rectangle {
        anchors.fill: parent
        radius: Appearance.rounding.large
        color: Appearance.m3colors.m3surfaceContainer
        border.width: 1
        border.color: Appearance.colors.colLayer0Border

        FocusScope {
            id: keyboard

            anchors.fill: parent
            focus: true
            Keys.onEscapePressed: root.dismissed()
            Keys.onPressed: (event) => {
                if (SrsService.stage === "training" && view.item)
                    view.item.key(event);

            }

                ColumnLayout {
                    id: content

                    x: 20 * root.fitScale
                    y: 20 * root.fitScale
                    width: 460
                    scale: root.fitScale
                    transformOrigin: Item.TopLeft
                    spacing: 12

                    RowLayout {
                        Layout.fillWidth: true
                        Layout.minimumWidth: content.width
                        Layout.maximumWidth: content.width

                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 3

                            StyledText {
                                text: "InsightBook · SRS"
                                font.bold: true
                            }

                            StyledText {
                                text: ({
                                    "connect": "1 / 3 · Сервер и вход",
                                    "setup": "2 / 3 · Настройка",
                                    "training": "3 / 3 · Повторение"
                                })[SrsService.stage]
                                color: Appearance.colors.colSubtext
                                font.pixelSize: Appearance.font.pixelSize.small
                            }

                        }

                        RippleButton {
                            implicitWidth: 32
                            implicitHeight: 32
                            visible: SrsService.stage === "training"
                            enabled: !SrsService.busy
                            onClicked: SrsService.refresh()

                            MaterialSymbol {
                                anchors.centerIn: parent
                                text: "refresh"
                                iconSize: 20
                            }

                        }

                        RippleButton {
                            implicitWidth: 32
                            implicitHeight: 32
                            visible: SrsService.stage === "training"
                            enabled: !SrsService.busy
                            onClicked: SrsService.stage = "setup"

                            MaterialSymbol {
                                anchors.centerIn: parent
                                text: "settings"
                                iconSize: 20
                            }

                        }
                        RippleButton {
                            implicitWidth: 32
                            implicitHeight: 32
                            onClicked: root.dismissed()

                            MaterialSymbol {
                                anchors.centerIn: parent
                                text: "close"
                                iconSize: 20
                            }

                        }





                    }

                    Rectangle {
                        Layout.fillWidth: true
                        implicitHeight: 1
                        color: Appearance.colors.colOutlineVariant
                    }

                    StyledText {
                        Layout.fillWidth: true
                        visible: !!SrsService.error
                        wrapMode: Text.Wrap
                        textFormat: Text.PlainText
                        text: SrsService.error
                        color: Appearance.m3colors.m3error
                        font.pixelSize: Appearance.font.pixelSize.small
                    }

                    Loader {
                        id: view

                        Layout.fillWidth: true
                        sourceComponent: SrsService.stage === "connect" ? connectionView : SrsService.stage === "setup" ? setupView : cardView
                    }

                }

        }

    }

    Component {
        id: connectionView

        SrsConnection {
        }

    }

    Component {
        id: setupView

        SrsSettings {
        }

    }

    Component {
        id: cardView

        SrsCard {
        }

    }

}
