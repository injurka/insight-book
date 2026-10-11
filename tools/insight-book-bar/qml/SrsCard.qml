import QtQuick
import QtQuick.Layouts
import qs.modules.common
import qs.modules.common.widgets

ColumnLayout {
    id: root
    spacing: 14
    property bool revealed: false
    readonly property var card: SrsService.card
    onCardChanged: revealed = false

    StyledText {
        Layout.fillWidth: true
        text: root.card ? "Осталось: " + SrsService.count + " · Повторено: " + SrsService.reviewed : "Очередь повторения"
        color: Appearance.colors.colSubtext
        font.pixelSize: Appearance.font.pixelSize.small
    }
    StyledText {
        Layout.fillWidth: true
        horizontalAlignment: Text.AlignHCenter
        wrapMode: Text.Wrap
        textFormat: Text.PlainText
        text: root.card ? root.card.word : SrsService.ready ? "На сейчас всё повторено ✨" : "Подключи свой аккаунт в настройках"
        font.pixelSize: root.card ? 32 : 20
    }
    StyledText {
        Layout.fillWidth: true
        visible: !!root.card?.transcription
        horizontalAlignment: Text.AlignHCenter
        textFormat: Text.PlainText
        wrapMode: Text.Wrap
        text: root.card?.transcription || ""
        color: Appearance.colors.colSubtext
    }
    StyledText {
        Layout.fillWidth: true
        visible: root.revealed && !!root.card
        horizontalAlignment: Text.AlignHCenter
        textFormat: Text.PlainText
        wrapMode: Text.Wrap
        text: root.card?.translation || "Перевод не указан"
        font.pixelSize: 20
    }
    RippleButton {
        Layout.fillWidth: true
        implicitHeight: 44
        visible: !!root.card && !root.revealed
        enabled: !SrsService.busy && !SrsService.error
        onClicked: root.revealed = true
        StyledText { anchors.centerIn: parent; text: "Показать перевод · Пробел" }
    }
    RowLayout {
        Layout.fillWidth: true
        visible: root.revealed && !!root.card
        spacing: 6
        Repeater {
            model: ["Снова", "Трудно", "Хорошо", "Легко"]
            delegate: RippleButton {
                required property string modelData
                required property int index
                Layout.fillWidth: true
                implicitHeight: 48
                enabled: !SrsService.busy && !SrsService.error
                colBackground: Appearance.colors.colLayer1
                onClicked: SrsService.review(index + 1)
                StyledText {
                    anchors.centerIn: parent
                    text: modelData + "\n" + (index + 1)
                    horizontalAlignment: Text.AlignHCenter
                    font.pixelSize: Appearance.font.pixelSize.small
                }
            }
        }
    }
}
