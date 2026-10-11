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
    buttonRadius: Appearance.rounding.small

    StyledText {
        id: title

        anchors.centerIn: parent
        text: root.label
        font.pixelSize: Appearance.font.pixelSize.small
        color: root.primary ? Appearance.m3colors.m3onPrimary : Appearance.colors.colOnLayer0
    }

}
