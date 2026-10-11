import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import Quickshell
import qs.modules.common
import qs.modules.common.widgets

PopupWindow {
    id: root

    required property Item button
    property bool settingsOpen: false

    signal dismissed()

    anchor.item: button
    anchor.edges: Config.options.bar.vertical ? (Config.options.bar.bottom ? Edges.Left : Edges.Right) : (Config.options.bar.bottom ? Edges.Top : Edges.Bottom)
    anchor.gravity: anchor.edges
    anchor.margins.left: 8
    anchor.margins.right: 8
    anchor.margins.top: 8
    anchor.margins.bottom: 8
    implicitWidth: 420
    implicitHeight: Math.min(620, content.implicitHeight + 32)
    color: "transparent"
    grabFocus: true
    onVisibleChanged: {
        if (!visible) {
            dismissed();
        } else {
            settingsOpen = SrsService.authRequired;
            keyboard.forceActiveFocus();
        }
    }

    Connections {
        function onAuthenticated() {
            root.settingsOpen = false;
        }

        target: SrsService
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
                if (root.settingsOpen || !SrsService.card || SrsService.busy || SrsService.error)
                    return ;

                if (event.key === Qt.Key_Space && !cardView.revealed) {
                    cardView.revealed = true;
                    event.accepted = true;
                } else if (cardView.revealed && event.key >= Qt.Key_1 && event.key <= Qt.Key_4) {
                    SrsService.review(event.key - Qt.Key_0);
                    event.accepted = true;
                }
            }

            Flickable {
                anchors.fill: parent
                anchors.margins: 16
                contentHeight: content.implicitHeight
                clip: true
                boundsBehavior: Flickable.StopAtBounds

                ColumnLayout {
                    id: content

                    width: parent.width
                    spacing: 14

                    RowLayout {
                        Layout.fillWidth: true

                        StyledText {
                            text: "InsightBook · SRS"
                            font.bold: true
                            Layout.fillWidth: true
                        }

                        RippleButton {
                            implicitWidth: 32
                            implicitHeight: 32
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
                            onClicked: root.settingsOpen = !root.settingsOpen

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

                    StyledText {
                        Layout.fillWidth: true
                        visible: SrsService.busy || !!SrsService.error
                        wrapMode: Text.Wrap
                        textFormat: Text.PlainText
                        text: SrsService.error || "Обновляю…"
                        color: SrsService.error ? Appearance.m3colors.m3error : Appearance.colors.colSubtext
                    }

                    SrsCard {
                        id: cardView

                        Layout.fillWidth: true
                        visible: !root.settingsOpen
                    }

                    Loader {
                        Layout.fillWidth: true
                        active: root.settingsOpen
                        visible: active

                        sourceComponent: SrsSettings {
                        }

                    }

                }

            }

        }

    }

}
