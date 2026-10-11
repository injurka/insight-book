import QtQuick
import QtQuick.Layouts
import Quickshell
import qs.modules.common
import qs.modules.common.widgets

PopupWindow {
    id: root

    required property Item button

    signal dismissed()

    anchor.item: button
    anchor.edges: Config.options.bar.vertical ? (Config.options.bar.bottom ? Edges.Left : Edges.Right) : (Config.options.bar.bottom ? Edges.Top : Edges.Bottom)
    anchor.gravity: anchor.edges
    implicitWidth: 500
    implicitHeight: Math.min(740, content.implicitHeight + 40)
    color: "transparent"
    grabFocus: true
    onVisibleChanged: {
        if (!visible)
            dismissed();
        else
            keyboard.forceActiveFocus();
    }

    anchor.margins {
        left: 8
        right: 8
        top: 8
        bottom: 8
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

            Flickable {
                anchors.fill: parent
                anchors.margins: 20
                contentHeight: content.implicitHeight
                clip: true
                boundsBehavior: Flickable.StopAtBounds

                ColumnLayout {
                    id: content

                    width: parent.width
                    spacing: 18

                    RowLayout {
                        Layout.fillWidth: true

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
                        visible: SrsService.busy || !!SrsService.error
                        wrapMode: Text.Wrap
                        textFormat: Text.PlainText
                        text: SrsService.error || ({
                            "connect": "Подключаюсь…",
                            "setup": "Загружаю тренировку…",
                            "training": "Обновляю…"
                        })[SrsService.stage]
                        color: SrsService.error ? Appearance.m3colors.m3error : Appearance.colors.colSubtext
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
