import QtQuick
import qs.modules.common
import qs.modules.common.widgets

RippleButton {
    id: root

    property string label
    property bool primary: false

    implicitHeight: 42
    implicitWidth: title.implicitWidth + 28
    colBackground: primary ? Appearance.colors.colPrimary : Appearance.colors.colLayer1
    colBackgroundHover: primary ? Appearance.colors.colPrimaryHover : Appearance.colors.colLayer1Hover
    opacity: 1
    buttonColor: !enabled ? Appearance.colors.colLayer2 : hovered ? colBackgroundHover : colBackground
    buttonRadius: Appearance.rounding.small

    SrsText {
        id: title

        anchors.centerIn: parent
        width: Math.min(implicitWidth, Math.max(0, root.width - 28))
        horizontalAlignment: Text.AlignHCenter
        elide: Text.ElideRight
        text: root.label
        font.pixelSize: Appearance.font.pixelSize.small
        color: !root.enabled ? Appearance.colors.colSubtext : root.primary ? Appearance.m3colors.m3onPrimary : Appearance.colors.colOnLayer0
    }

}
