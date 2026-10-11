import QtQuick
import QtQuick.Layouts
import qs.modules.common

Rectangle {
    id: root

    default property alias contents: body.data

    Layout.fillWidth: true
    implicitHeight: body.implicitHeight + 24
    radius: Appearance.rounding.normal
    color: Appearance.colors.colLayer1
    data: [
        ColumnLayout {
            id: body

            x: 12
            y: 12
            width: root.width - 24
            spacing: 10
        }
    ]
}
