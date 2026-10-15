import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import qs.modules.common
import qs.modules.common.widgets
import "SrsStatistics.js" as Stats

ColumnLayout {
    id: root
    signal back()
    readonly property var statsData: SrsService.statistics
    readonly property var days: Stats.calendar(statsData)
    readonly property var ranks: Stats.achievements(statsData)
    spacing: 14

    RowLayout {
        Layout.fillWidth: true
        RippleButton {
            implicitWidth: 32
            implicitHeight: 32
            Accessible.name: "Назад к повторению"
            onClicked: root.back()
            MaterialSymbol { anchors.centerIn: parent; text: "arrow_back"; iconSize: 22 }
            StyledToolTip { text: "Назад к повторению" }
        }
        SrsText {
            Layout.fillWidth: true
            text: "Статистика активности"
            font.bold: true
            font.pixelSize: Appearance.font.pixelSize.normal
            wrapMode: Text.Wrap
        }
        RippleButton {
            implicitWidth: 32
            implicitHeight: 32
            enabled: !SrsService.busy
            Accessible.name: "Обновить статистику"
            onClicked: SrsService.request({action: "statistics"})
            MaterialSymbol { anchors.centerIn: parent; text: "refresh"; iconSize: 22 }
        }
    }
    Rectangle { Layout.fillWidth: true; implicitHeight: 1; color: Appearance.colors.colOutlineVariant }
    SrsText {
        Layout.fillWidth: true
        visible: SrsService.busy && SrsService.action === "statistics"
        text: "Загрузка статистики…"
        color: Appearance.colors.colSubtext
    }
    SrsText {
        Layout.fillWidth: true
        visible: !!SrsService.error
        text: SrsService.error
        color: Appearance.m3colors.m3error
        wrapMode: Text.Wrap
    }
    ScrollView {
        id: scroll
        Layout.fillWidth: true
        Layout.fillHeight: true
        clip: true
        contentWidth: availableWidth
        ScrollBar.horizontal.policy: ScrollBar.AlwaysOff
        ColumnLayout {
            width: scroll.availableWidth
            spacing: 14
            visible: root.statsData !== null
            GridLayout {
                Layout.fillWidth: true
                columns: 2
                columnSpacing: 10
                rowSpacing: 10
                Repeater {
                    model: Stats.summary(root.statsData)
                    SrsSection {
                        required property var modelData
                        Layout.fillWidth: true
                        Layout.preferredWidth: 1
                        SrsText {
                            Layout.fillWidth: true
                            text: Number(modelData.value).toLocaleString(Qt.locale("ru_RU"), 'f', 0)
                            color: Appearance.colors.colPrimary
                            font.pixelSize: 30
                            font.bold: true
                            horizontalAlignment: Text.AlignHCenter
                        }
                        SrsText {
                            Layout.fillWidth: true
                            text: modelData.label
                            color: Appearance.colors.colSubtext
                            font.pixelSize: Appearance.font.pixelSize.small
                            horizontalAlignment: Text.AlignHCenter
                            wrapMode: Text.Wrap
                        }
                    }
                }
            }
            SrsText { text: "Достижения и уровни"; font.bold: true }
            Repeater {
                model: root.ranks
                SrsAchievementCard {
                    required property var modelData
                    achievement: modelData
                }
            }
            SrsText {
                visible: !root.ranks.length
                text: "Уровни появятся по мере изучения слов."
                Layout.fillWidth: true
                wrapMode: Text.Wrap
                color: Appearance.colors.colSubtext
            }
            SrsSection {
                Layout.fillWidth: true
                Layout.minimumWidth: 0
                Layout.preferredWidth: 1
                SrsText { text: "Активность за полгода"; font.bold: true }
                SrsText {
                    Layout.fillWidth: true
                    text: Stats.dateRange(root.days)
                    font.pixelSize: Appearance.font.pixelSize.small
                    color: Appearance.colors.colSubtext
                }
                GridLayout {
                    id: activityGrid
                    property real cellSize: Math.max(10, (width - (columns - 1) * columnSpacing) / columns)
                    Layout.fillWidth: true
                    columns: 26
                    rows: 7
                    flow: GridLayout.TopToBottom
                    columnSpacing: 3
                    rowSpacing: 3
                    Repeater {
                        model: root.days
                        Rectangle {
                            required property var modelData
                            Layout.fillWidth: true
                            Layout.preferredWidth: activityGrid.cellSize
                            Layout.preferredHeight: activityGrid.cellSize
                            radius: Math.min(4, activityGrid.cellSize / 3)
                            color: modelData.level ? Appearance.colors.colPrimary : Appearance.colors.colOutlineVariant
                            opacity: modelData.future ? 0.15 : modelData.level ? 0.25 + modelData.level * 0.1875 : 0.5
                            HoverHandler { id: hover }
                            ToolTip.visible: hover.hovered
                            ToolTip.text: modelData.date + ": " + modelData.count + " действий"
                        }
                    }
                }
                RowLayout {
                    Layout.alignment: Qt.AlignRight
                    SrsText { text: "Меньше"; font.pixelSize: Appearance.font.pixelSize.small }
                    Repeater {
                        model: 5
                        Rectangle {
                            required property int index
                            implicitWidth: 11
                            implicitHeight: 11
                            radius: 3
                            color: index ? Appearance.colors.colPrimary : Appearance.colors.colOutlineVariant
                            opacity: index ? 0.25 + index * 0.1875 : 0.5
                        }
                    }
                    SrsText { text: "Больше"; font.pixelSize: Appearance.font.pixelSize.small }
                }
            }
        }
    }
}
