import QtQuick
import QtQuick.Layouts
import qs.modules.common
import "SrsStatistics.js" as Stats

SrsSection {
    id: root
    required property var achievement
    Layout.minimumWidth: 0
    Layout.preferredWidth: 1

    function words(count) {
        return Number(count).toLocaleString(Qt.locale("ru_RU"), 'f', 0) + " " + Stats.wordForm(count);
    }

    RowLayout {
        Layout.fillWidth: true
        spacing: 12
        SrsText {
            Layout.fillWidth: true
            Layout.minimumWidth: 0
            text: root.achievement.language
            font.bold: true
            font.pixelSize: Appearance.font.pixelSize.normal
            wrapMode: Text.Wrap
        }
        Rectangle {
            implicitWidth: rankLabel.implicitWidth + 18
            implicitHeight: 28
            radius: 9
            color: Appearance.colors.colSecondaryContainer
            SrsText {
                id: rankLabel
                anchors.centerIn: parent
                text: root.achievement.rank
                color: Appearance.colors.colOnSecondaryContainer
                font.pixelSize: Appearance.font.pixelSize.small
            }
        }
    }

    RowLayout {
        Layout.fillWidth: true
        spacing: 8
        SrsText {
            text: root.words(root.achievement.count)
            font.pixelSize: 22
            font.bold: true
            color: Appearance.colors.colPrimary
        }
        SrsText {
            Layout.fillWidth: true
            text: "изучено"
            color: Appearance.colors.colSubtext
            font.pixelSize: Appearance.font.pixelSize.small
        }
    }

    Rectangle {
        Layout.fillWidth: true
        implicitHeight: 6
        radius: 3
        color: Appearance.colors.colOutlineVariant
        Accessible.role: Accessible.ProgressBar
        Accessible.name: "Прогресс словарного запаса: " + root.achievement.count + " из " + root.achievement.target
        Rectangle {
            width: parent.width * root.achievement.progress
            height: parent.height
            radius: parent.radius
            color: Appearance.colors.colPrimary
        }
    }

    SrsText {
        Layout.fillWidth: true
        Layout.minimumWidth: 0
        text: root.achievement.completed
            ? "Достигнут максимальный уровень"
            : "Ещё " + root.words(root.achievement.remaining) + " до уровня «" + root.achievement.next + "»"
        color: Appearance.colors.colSubtext
        font.pixelSize: Appearance.font.pixelSize.small
        wrapMode: Text.Wrap
    }
}
