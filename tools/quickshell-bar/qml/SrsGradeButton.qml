import QtQuick
import QtQuick.Layouts
import qs.modules.common
import qs.modules.common.widgets

RippleButton {
    id: root

    required property int grade
    required property string label
    required property string interval
    readonly property bool light: Appearance.m3colors.m3surface.r * 0.2126 + Appearance.m3colors.m3surface.g * 0.7152 + Appearance.m3colors.m3surface.b * 0.0722 > 0.5
    readonly property color tone: (light ? ["#b3261e", "#8c6200", "#7542a5", "#216d37"] : ["#f28b82", "#f6c65b", "#c792ea", "#81c995"])[grade - 1]

    Layout.fillWidth: true
    Layout.minimumWidth: 0
    implicitHeight: 60
    implicitWidth: 104
    opacity: 1
    colBackground: Qt.rgba(tone.r, tone.g, tone.b, 0.12)
    colBackgroundHover: Qt.rgba(tone.r, tone.g, tone.b, 0.22)
    buttonColor: !enabled ? Appearance.colors.colLayer2 : hovered ? colBackgroundHover : colBackground
    buttonRadius: Appearance.rounding.small
    Accessible.name: label + ", через " + interval + ", клавиша " + grade

    Rectangle {
        anchors.fill: parent
        radius: root.buttonRadius
        color: "transparent"
        border.width: 1
        border.color: root.enabled ? Qt.rgba(root.tone.r, root.tone.g, root.tone.b, 0.5) : Appearance.colors.colOutlineVariant
    }

    ColumnLayout {
        anchors.centerIn: parent
        spacing: 4

        SrsText {
            Layout.alignment: Qt.AlignHCenter
            text: root.label
            font.bold: true
            font.pixelSize: Appearance.font.pixelSize.small
            color: root.enabled ? root.tone : Appearance.colors.colSubtext
        }

        SrsText {
            Layout.alignment: Qt.AlignHCenter
            text: root.interval
            font.pixelSize: 11
            color: root.enabled ? root.tone : Appearance.colors.colSubtext
        }

    }

}
