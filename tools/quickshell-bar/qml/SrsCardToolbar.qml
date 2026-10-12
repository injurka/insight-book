import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import qs.modules.common
import qs.modules.common.widgets

ColumnLayout {
    id: root
    required property var card
    property string expanded: ""
    property int wordId: -1
    readonly property var sections: [
        {id: "grammar", label: "Грамматика", icon: "extension", text: card?.grammarNote || ""},
        {id: "vocabulary", label: "Лексика", icon: "menu_book", text: card?.vocabularyNote || ""},
        {id: "notes", label: "Заметки", icon: "sticky_note_2", text: card?.notes || ""}
    ].filter(section => section.text.length > 0)
    readonly property var activeSection: sections.find(section => section.id === expanded)
    onCardChanged: {
        if ((card?.id || -1) !== wordId) {
            wordId = card?.id || -1;
            expanded = "";
        }
    }
    spacing: 10
    SrsSection {
        RowLayout {
            objectName: "cardToolbarActions"
            Layout.alignment: Qt.AlignHCenter
            Layout.minimumWidth: implicitWidth
            Layout.maximumWidth: implicitWidth
            spacing: 6
            RippleButton {
                implicitWidth: 36
                implicitHeight: 36
                enabled: !SrsService.busy
                opacity: 1
                colBackground: Appearance.colors.colSecondaryContainer
                colBackgroundHover: Appearance.colors.colSecondaryContainerHover
                onClicked: SrsService.playAudio()
                Accessible.name: "Послушать слово"
                StyledToolTip { font.family: "Maple Mono"; font.variableAxes: ({}); text: "Послушать слово"; delay: 500 }
                MaterialSymbol {
                    anchors.centerIn: parent
                    text: "volume_up"
                    iconSize: 20
                    color: parent.enabled ? Appearance.colors.colOnSecondaryContainer : Appearance.colors.colSubtext
                }
            }
            Repeater {
                model: root.sections
                delegate: RippleButton {
                    id: action
                    required property var modelData
                    implicitWidth: 36
                    implicitHeight: 36
                    toggled: root.expanded === modelData.id
                    colBackground: Appearance.colors.colSecondaryContainer
                    colBackgroundHover: Appearance.colors.colSecondaryContainerHover
                    colBackgroundToggled: Appearance.colors.colPrimary
                    colBackgroundToggledHover: Appearance.colors.colPrimaryHover
                    onClicked: root.expanded = toggled ? "" : modelData.id
                    Accessible.name: modelData.label
                    StyledToolTip { font.family: "Maple Mono"; font.variableAxes: ({}); text: modelData.label; delay: 500 }
                    MaterialSymbol {
                        anchors.centerIn: parent
                        text: action.modelData.icon
                        iconSize: 20
                        color: action.toggled ? Appearance.colors.colOnPrimary : Appearance.colors.colOnSecondaryContainer
                    }
                }
            }
        }
    }
    SrsSection {
        visible: !!root.activeSection
        RowLayout {
            Layout.fillWidth: true
            spacing: 8
            MaterialSymbol {
                text: root.activeSection?.icon || ""
                iconSize: 19
                color: Appearance.colors.colPrimary
            }
            SrsText {
                Layout.fillWidth: true
                text: (root.activeSection?.label || "").toUpperCase()
                font.pixelSize: Appearance.font.pixelSize.small * 0.9
                font.bold: true
                font.letterSpacing: 1.2
                color: Appearance.colors.colPrimary
            }
        }
        SrsText {
            Layout.fillWidth: true
            text: root.activeSection?.text || ""
            textFormat: Text.StyledText
            wrapMode: Text.Wrap
            color: Appearance.colors.colOnLayer0
        }
    }
}
