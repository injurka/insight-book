import QtQuick
import QtQuick.Controls
import qs.modules.common.widgets

Flickable {
    id: root
    property real maximumNaturalHeight: 720
    implicitHeight: Math.min(card.implicitHeight, maximumNaturalHeight)
    contentWidth: width
    contentHeight: Math.max(height, card.implicitHeight)
    clip: true
    interactive: contentHeight > height
    boundsBehavior: Flickable.StopAtBounds
    onContentHeightChanged: contentY = Math.max(0, Math.min(contentY, contentHeight - height))

    function key(event) { card.key(event); }

    SrsCard {
        id: card
        width: root.width
        height: root.contentHeight
        onCardChanged: root.contentY = 0
    }
    ScrollBar.vertical: StyledScrollBar {}
}
