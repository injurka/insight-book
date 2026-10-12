import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import qs.services
import qs.modules.common
import qs.modules.common.widgets

PanelWindow {
    id: root

    required property Item button
    property var targetScreen
    property bool opened: false
    property bool detached: false
    readonly property real contentScale: detached ? SrsService.stage === "training" ? 1 : Math.min(1, floating.width / 500, floating.height / (content.implicitHeight + 40)) : fitScale
    onDetachedChanged: Qt.callLater(() => keyboard.forceActiveFocus())

    signal dismissed()

    function toggleDetached() {
        if (detached) {
            detached = false;
        } else if (!floatingRule.running) {
            // Install the mapping rule before exposing the native window.
            floatingRule.running = true;
        }
    }

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
    readonly property real fitScale: Math.min(1, ((root.screen?.height || 1080) - 40) / Math.max(700, content.implicitHeight + 40))
    implicitWidth: 500 * fitScale
    implicitHeight: Math.max(700, content.implicitHeight + 40) * fitScale
    color: "transparent"
    onVisibleChanged: {
        if (visible) {
            GlobalFocusGrab.addDismissable(root);
            keyboard.forceActiveFocus();
        } else {
            GlobalFocusGrab.removeDismissable(root);
            if (!detached) dismissed();
        }
    }
    Connections {
        target: GlobalFocusGrab
        function onDismissed() { if (root.visible && !root.detached) root.dismissed(); }
    }

    FloatingWindow {
        id: floating
        title: "InsightBook · SRS · " + root.screen.name
        parentWindow: null
        screen: root.screen
        visible: root.opened && root.detached
        implicitWidth: 500
        implicitHeight: Math.max(700, Math.min((root.screen?.height || 1080) - 80, content.implicitHeight + 40))
        minimumSize: Qt.size(500, 700)
        maximumSize: Qt.size(500, Math.max(700, (root.screen?.height || 1080) - 80))
        color: "transparent"
        onVisibleChanged: {
            if (!visible && root.detached && root.opened) root.dismissed();
            if (visible) keyboard.forceActiveFocus();
        }
    }

    Process {
        id: floatingRule
        // QML owns the rounded frame; compositor decorations would overlap it.
        command: ["hyprctl", "eval", "if not insightBookSrsFloatRule then insightBookSrsFloatRule = hl.window_rule({name='insight-book-srs-floating', match={title='^InsightBook · SRS · .*$'}, float=true, center=true, no_anim=true}) end; if not insightBookSrsFrameRule then insightBookSrsFrameRule = hl.window_rule({name='insight-book-srs-frame', match={title='^InsightBook · SRS · .*$'}, border_size=0, rounding=0, no_shadow=true}) end"]
        onExited: (code, status) => {
            if (code === 0 && root.opened) root.detached = true;
        }
    }

    Rectangle {
        id: frame
        parent: root.detached ? floating.contentItem : root.contentItem
        anchors.fill: parent
        radius: Appearance.rounding.large
        antialiasing: true
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

                    x: (frame.width - width * root.contentScale) / 2
                    y: 20 * root.contentScale
                    width: 460
                    height: SrsService.stage === "training" ? Math.max(0, frame.height / root.contentScale - 40) : implicitHeight
                    scale: root.contentScale
                    transformOrigin: Item.TopLeft
                    spacing: 12

                    Item {
                        id: header
                        objectName: "popupHeader"
                        Layout.fillWidth: true
                        Layout.minimumWidth: content.width
                        Layout.maximumWidth: content.width
                        implicitHeight: Math.max(title.implicitHeight, actions.implicitHeight)

                        ColumnLayout {
                            id: title
                            anchors.left: parent.left
                            anchors.right: actions.left
                            anchors.rightMargin: 8
                            anchors.verticalCenter: parent.verticalCenter
                            spacing: 3
                            SrsText {
                                text: "InsightBook · SRS"
                                font.bold: true
                            }
                            SrsText {
                                text: ({connect: "Сервер и вход", setup: "Настройка", training: "Повторение"})[SrsService.stage]
                                color: Appearance.colors.colSubtext
                                font.pixelSize: Appearance.font.pixelSize.small
                            }
                        }
                        MouseArea {
                            anchors.fill: title
                            enabled: root.detached
                            cursorShape: Qt.SizeAllCursor
                            onPressed: floating.startSystemMove()
                        }
                        RowLayout {
                            id: actions
                            objectName: "headerActions"
                            anchors.right: parent.right
                            anchors.verticalCenter: parent.verticalCenter
                            spacing: 4
                            RippleButton {
                                Layout.minimumWidth: 32
                                Layout.maximumWidth: 32
                                implicitHeight: 32
                                visible: SrsService.stage === "training"
                                enabled: !SrsService.busy
                                opacity: 1
                                onClicked: SrsService.refresh()
                                MaterialSymbol {
                                    anchors.centerIn: parent
                                    text: "refresh"
                                    iconSize: 20
                                    color: parent.enabled ? Appearance.colors.colOnLayer0 : Appearance.colors.colSubtext
                                }
                            }
                            RippleButton {
                                Layout.minimumWidth: 32
                                Layout.maximumWidth: 32
                                implicitHeight: 32
                                visible: SrsService.stage === "training"
                                enabled: !SrsService.busy
                                opacity: 1
                                onClicked: SrsService.stage = "setup"
                                MaterialSymbol {
                                    anchors.centerIn: parent
                                    text: "settings"
                                    iconSize: 20
                                    color: parent.enabled ? Appearance.colors.colOnLayer0 : Appearance.colors.colSubtext
                                }
                            }
                            RippleButton {
                                objectName: "detachButton"
                                Layout.minimumWidth: 32
                                Layout.maximumWidth: 32
                                implicitHeight: 32
                                onClicked: root.toggleDetached()
                                Accessible.name: root.detached ? "Вернуть к панели" : "Открыть отдельным окном"
                                StyledToolTip { font.family: "Maple Mono"; font.variableAxes: ({}); text: root.detached ? "Вернуть к панели" : "Открыть отдельным окном"; delay: 500 }
                                MaterialSymbol {
                                    anchors.centerIn: parent
                                    text: root.detached ? "dock_to_right" : "open_in_new"
                                    iconSize: 20
                                }
                            }
                        }
                    }

                    Rectangle {
                        Layout.fillWidth: true
                        implicitHeight: 1
                        color: Appearance.colors.colOutlineVariant
                    }

                    SrsText {
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
                        Layout.fillHeight: SrsService.stage === "training"
                        Layout.minimumHeight: SrsService.stage === "training" ? 0 : implicitHeight
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

        SrsCardViewport {
            maximumNaturalHeight: Math.max(120, (root.screen?.height || 1080) - header.implicitHeight - 100)
        }

    }

}
