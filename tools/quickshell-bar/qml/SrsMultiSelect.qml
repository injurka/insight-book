import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import qs.modules.common
import qs.modules.common.widgets

ColumnLayout {
    id: root
    required property string title
    required property string allLabel
    required property var options
    property var selected: []
    signal selectionChanged(var values)
    Layout.minimumWidth: 0
    Layout.preferredWidth: 220
    spacing: 4
    SrsText {
        text: root.title
        color: Appearance.colors.colSubtext
        font.pixelSize: Appearance.font.pixelSize.small
    }
    SrsAction {
        id: button
        objectName: "selectionButton"
        Layout.fillWidth: true
        Layout.minimumWidth: 0
        Layout.preferredWidth: 220
        implicitHeight: 40
        label: root.selected.length === 0 ? root.allLabel : root.selected.length === 1 ? (root.options.find(o => String(o.id) === root.selected[0])?.name || root.selected[0]) : root.selected.length + " выбрано"
        onClicked: menu.open()
        Popup {
            id: menu
            objectName: "selectionMenu"
            y: button.height + 4
            width: button.width
            height: Math.min(280, choices.contentHeight + 16)
            padding: 8
            closePolicy: Popup.CloseOnEscape | Popup.CloseOnPressOutside
            background: Rectangle {
                radius: Appearance.rounding.normal
                color: Appearance.m3colors.m3surfaceContainerHigh
                border.width: 1
                border.color: Appearance.colors.colOutlineVariant
            }
            contentItem: ListView {
                id: choices
                clip: true
                model: [{id: "all", name: root.allLabel}].concat(root.options)
                delegate: RippleButton {
                    id: option
                    required property var modelData
                    width: choices.width
                    implicitHeight: 36
                    toggled: modelData.id === "all" ? root.selected.length === 0 : root.selected.includes(String(modelData.id))
                    onClicked: {
                        const id = String(modelData.id);
                        const values = id === "all" ? [] : root.selected.includes(id) ? root.selected.filter(s => s !== id) : root.selected.concat([id]);
                        root.selectionChanged(values);
                    }
                    RowLayout {
                        anchors.fill: parent
                        anchors.margins: 8
                        MaterialSymbol {
                            text: parent.parent.toggled ? "check_box" : "check_box_outline_blank"
                            iconSize: 18
                            color: option.toggled ? Appearance.colors.colOnPrimary : Appearance.colors.colOnLayer0
                        }
                        SrsText {
                            Layout.fillWidth: true
                            text: modelData.name
                            color: option.toggled ? Appearance.colors.colOnPrimary : Appearance.colors.colOnLayer0
                            elide: Text.ElideRight
                        }
                    }
                }
            }
        }
    }
}
