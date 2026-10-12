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
    property string aiPanel: ""
    property int aiResultCardId: -1
    property var chatMessages: []
    property int chatRequestCardId: -1
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
            aiPanel = "";
            aiResultCardId = -1;
            chatMessages = [];
            chatRequestCardId = -1;
            SrsService.clearAiResult();
        }
    }
    function toggleExamples() {
        if (aiPanel === "examples") {
            aiPanel = "";
            return;
        }

        aiPanel = "examples";
        if (aiResultCardId === card.id && SrsService.aiResultKind === "ai-examples" && SrsService.aiResult !== null) return;
        if (SrsService.busy) return;

        aiResultCardId = card.id;
        SrsService.generateAiExamples(card.word, card.language || "en");
    }
    function sendChat() {
        const prompt = chatInput.text.trim();
        if (!prompt || SrsService.busy) return;
        submitChat(prompt);
        chatInput.clear();
    }
    function submitChat(prompt) {
        if (!prompt || SrsService.busy) return;
        chatMessages = chatMessages.concat([{speaker: "Вы", text: prompt}, {speaker: "ИИ", text: "…"}]);
        chatRequestCardId = card.id;
        SrsService.askAi(card.word, card.language || "en", prompt);
    }
    function exampleSections(data) {
        if (!data || typeof data !== "object") return [];
        const sections = [];
        const vocabulary = Array.isArray(data.vocabulary) ? data.vocabulary.filter(item => item?.word) : [];
        if (vocabulary.length || data.word || data.transcription || data.main_translations?.length) {
            sections.push({
                title: "СЛОВАРЬ",
                icon: "menu_book",
                items: vocabulary.length ? vocabulary.map(item => ({primary: item.word, transcription: item.transcription, secondary: item.meaning})) : [{
                    primary: data.word || "",
                    transcription: data.transcription || "",
                    secondary: Array.isArray(data.main_translations) ? data.main_translations.join(", ") : ""
                }]
            });
        }
        if (data.mnemonics) sections.push({title: "МНЕМОНИКА", icon: "lightbulb", text: data.mnemonics});
        if (data.grammar_note) sections.push({title: "ГРАММАТИКА", icon: "menu_book", text: data.grammar_note});
        const examples = Array.isArray(data.examples) ? data.examples.filter(item => item?.original) : [];
        if (examples.length) {
            sections.push({
                title: "ПРИМЕРЫ",
                icon: "format_list_bulleted",
                items: examples.map(item => ({
                    label: item.type,
                    primary: item.original,
                    transcription: item.transcription,
                    secondary: item.translation,
                    detail: item.literal_translation
                }))
            });
        }
        const collocations = Array.isArray(data.collocations) ? data.collocations.filter(item => item?.original) : [];
        if (collocations.length) {
            sections.push({
                title: "СЛОВОСОЧЕТАНИЯ",
                icon: "link",
                items: collocations.map(item => ({primary: item.original, transcription: item.transcription, secondary: item.translation}))
            });
        }
        const synonyms = Array.isArray(data.relations?.synonyms) ? data.relations.synonyms.filter(item => item?.word) : [];
        if (synonyms.length) {
            sections.push({
                title: "СИНОНИМЫ",
                icon: "swap_horiz",
                items: synonyms.map(item => ({primary: item.word, transcription: item.transcription, secondary: item.translation}))
            });
        }
        const antonyms = Array.isArray(data.relations?.antonyms) ? data.relations.antonyms.filter(item => item?.word) : [];
        if (antonyms.length) {
            sections.push({
                title: "АНТОНИМЫ",
                icon: "swap_horiz",
                items: antonyms.map(item => ({primary: item.word, transcription: item.transcription, secondary: item.translation}))
            });
        }
        return sections;
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
                toggled: root.aiPanel === "chat"
                colBackground: Appearance.colors.colSecondaryContainer
                colBackgroundHover: Appearance.colors.colSecondaryContainerHover
                colBackgroundToggled: Appearance.colors.colPrimary
                onClicked: root.aiPanel = root.aiPanel === "chat" ? "" : "chat"
                Accessible.name: "Свободный вопрос по слову"
                StyledToolTip { font.family: "Maple Mono"; font.variableAxes: ({}); text: "Свободный вопрос по слову"; delay: 500 }
                MaterialSymbol {
                    id: chatIcon
                    anchors.centerIn: parent
                    text: SrsService.busy && SrsService.action === "ai-chat" && root.chatRequestCardId === root.card?.id ? "progress_activity" : "question_answer"
                    iconSize: 20
                    color: parent.toggled ? Appearance.colors.colOnPrimary : Appearance.colors.colOnSecondaryContainer
                }
                RotationAnimation {
                    target: chatIcon
                    property: "rotation"
                    from: 0
                    to: 360
                    duration: 900
                    loops: Animation.Infinite
                    running: SrsService.busy && SrsService.action === "ai-chat" && root.chatRequestCardId === root.card?.id
                    onStopped: chatIcon.rotation = 0
                }
            }
            RippleButton {
                implicitWidth: 36
                implicitHeight: 36
                toggled: root.aiPanel === "examples"
                colBackground: Appearance.colors.colSecondaryContainer
                colBackgroundHover: Appearance.colors.colSecondaryContainerHover
                colBackgroundToggled: Appearance.colors.colPrimary
                onClicked: root.toggleExamples()
                Accessible.name: "ИИ: контекст и примеры"
                StyledToolTip { font.family: "Maple Mono"; font.variableAxes: ({}); text: "ИИ: контекст и примеры"; delay: 500 }
                MaterialSymbol {
                    id: examplesIcon
                    anchors.centerIn: parent
                    text: SrsService.busy && SrsService.action === "ai-examples" && root.aiPanel === "examples" ? "progress_activity" : "smart_toy"
                    iconSize: 20
                    color: parent.toggled ? Appearance.colors.colOnPrimary : Appearance.colors.colOnSecondaryContainer
                }
                RotationAnimation {
                    target: examplesIcon
                    property: "rotation"
                    from: 0
                    to: 360
                    duration: 900
                    loops: Animation.Infinite
                    running: SrsService.busy && SrsService.action === "ai-examples" && root.aiPanel === "examples"
                    onStopped: examplesIcon.rotation = 0
                }
            }
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
        visible: root.aiPanel === "chat"
        SrsText {
            Layout.fillWidth: true
            text: "ВОПРОС ПО СЛОВУ · " + root.card.word
            font.pixelSize: Appearance.font.pixelSize.small * 0.85
            font.bold: true
            color: Appearance.colors.colPrimary
        }
        Repeater {
            model: root.chatMessages
            delegate: SrsText {
                required property var modelData
                Layout.fillWidth: true
                text: modelData.speaker + ": " + modelData.text
                textFormat: modelData.speaker === "ИИ" ? Text.MarkdownText : Text.PlainText
                wrapMode: Text.Wrap
                color: modelData.speaker === "ИИ" ? Appearance.colors.colOnLayer0 : Appearance.colors.colSubtext
            }
        }
        SrsText {
            Layout.fillWidth: true
            visible: root.chatMessages.length === 0
            text: "Быстрые вопросы"
            color: Appearance.colors.colSubtext
        }
        RowLayout {
            Layout.fillWidth: true
            visible: root.chatMessages.length === 0
            spacing: 6
            Repeater {
                model: [
                    {label: "Произношение", prompt: "Объясни произношение этого слова."},
                    {label: "Примеры", prompt: "Приведи примеры употребления этого слова."},
                    {label: "Грамматика", prompt: "Объясни грамматику и употребление этого слова."}
                ]
                delegate: SrsAction {
                    required property var modelData
                    Layout.fillWidth: true
                    label: modelData.label
                    enabled: !SrsService.busy
                    onClicked: root.submitChat(modelData.prompt)
                }
            }
        }
        SrsText {
            Layout.fillWidth: true
            visible: !!SrsService.aiError
            text: SrsService.aiError
            textFormat: Text.PlainText
            wrapMode: Text.Wrap
            color: Appearance.colors.colError
        }
        RowLayout {
            Layout.fillWidth: true
            spacing: 8
            Item {
                id: chatInput
                Layout.fillWidth: true
                implicitHeight: 44
                property alias text: chatTextInput.text
                function clear() { chatTextInput.clear(); }
                Rectangle {
                    anchors.fill: parent
                    radius: Appearance.rounding.normal
                    color: Appearance.colors.colLayer2
                    border.width: 1
                    border.color: chatTextInput.activeFocus ? Appearance.colors.colPrimary : Appearance.colors.colOutlineVariant
                }
                TextInput {
                    id: chatTextInput
                    anchors.fill: parent
                    anchors.leftMargin: 15
                    anchors.rightMargin: 15
                    verticalAlignment: TextInput.AlignVCenter
                    font.family: "Maple Mono"
                    font.pixelSize: Appearance.font.pixelSize.small * 0.8625
                    font.variableAxes: ({})
                    color: Appearance.colors.colOnLayer0
                    selectionColor: Appearance.colors.colSecondaryContainer
                    selectedTextColor: Appearance.colors.colOnSecondaryContainer
                    clip: true
                    selectByMouse: true
                    enabled: !SrsService.busy
                    Accessible.name: "Вопрос по слову"
                    onAccepted: root.sendChat()
                }
                SrsText {
                    anchors.left: parent.left
                    anchors.leftMargin: 15
                    anchors.verticalCenter: parent.verticalCenter
                    visible: !chatTextInput.text
                    text: "Спроси об этом слове"
                    font.pixelSize: Appearance.font.pixelSize.small * 0.8625
                    color: Appearance.colors.colSubtext
                }
            }
            RippleButton {
                implicitWidth: 44
                implicitHeight: 44
                enabled: !!chatInput.text.trim() && !SrsService.busy
                buttonRadius: Appearance.rounding.full
                colBackground: Appearance.colors.colPrimary
                colBackgroundHover: Appearance.colors.colPrimaryHover
                colRipple: Appearance.colors.colPrimaryActive
                onClicked: root.sendChat()
                Accessible.name: "Отправить вопрос"
                StyledToolTip { font.family: "Maple Mono"; font.variableAxes: ({}); text: "Отправить вопрос"; delay: 500 }
                MaterialSymbol {
                    anchors.centerIn: parent
                    text: "arrow_upward"
                    iconSize: 20
                    color: parent.enabled ? Appearance.colors.colOnPrimary : Appearance.colors.colSubtext
                }
            }
        }
    }
    ColumnLayout {
        Layout.fillWidth: true
        visible: root.aiPanel === "examples"
        spacing: 10
        SrsText {
            Layout.fillWidth: true
            text: "ИИ · КОНТЕКСТ И ПРИМЕРЫ"
            font.pixelSize: Appearance.font.pixelSize.small * 0.85
            font.bold: true
            color: Appearance.colors.colPrimary
        }
        SrsText {
            Layout.fillWidth: true
            visible: SrsService.busy && SrsService.action === "ai-examples"
            text: "Готовлю контекст и примеры…"
            color: Appearance.colors.colSubtext
        }
        SrsText {
            Layout.fillWidth: true
            visible: !SrsService.busy && root.aiResultCardId === root.card?.id && SrsService.aiResultKind === "ai-examples" && !SrsService.aiError && root.exampleSections(SrsService.aiResult).length === 0
            text: "Для этого слова пока нет дополнительных сведений."
            wrapMode: Text.Wrap
            color: Appearance.colors.colSubtext
        }
        Repeater {
            model: root.aiResultCardId === root.card?.id && SrsService.aiResultKind === "ai-examples" ? root.exampleSections(SrsService.aiResult) : []
            delegate: SrsSection {
                required property var modelData

                RowLayout {
                    Layout.fillWidth: true
                    spacing: 8
                    MaterialSymbol {
                        text: modelData.icon
                        iconSize: 19
                        color: Appearance.colors.colPrimary
                    }
                    SrsText {
                        Layout.fillWidth: true
                        text: modelData.title
                        font.pixelSize: Appearance.font.pixelSize.small
                        font.bold: true
                        font.letterSpacing: 1
                        color: Appearance.colors.colPrimary
                    }
                }
                SrsText {
                    Layout.fillWidth: true
                    visible: !!modelData.text
                    text: modelData.text || ""
                    wrapMode: Text.Wrap
                    color: Appearance.colors.colOnLayer0
                }
                Repeater {
                    model: modelData.items || []
                    delegate: ColumnLayout {
                        required property int index
                        required property var modelData
                        Layout.fillWidth: true
                        spacing: 4

                        Rectangle {
                            Layout.fillWidth: true
                            Layout.topMargin: 2
                            Layout.bottomMargin: 4
                            implicitHeight: 1
                            color: Appearance.colors.colOutlineVariant
                            visible: index > 0
                        }
                        Rectangle {
                            visible: !!modelData.label
                            implicitWidth: typeLabel.implicitWidth + 14
                            implicitHeight: typeLabel.implicitHeight + 6
                            radius: 5
                            color: Appearance.colors.colLayer2
                            SrsText {
                                id: typeLabel
                                anchors.centerIn: parent
                                text: modelData.label || ""
                                font.pixelSize: Appearance.font.pixelSize.small * 0.8
                                color: Appearance.colors.colSubtext
                            }
                        }
                        SrsText {
                            Layout.fillWidth: true
                            visible: !!modelData.primary
                            text: modelData.primary || ""
                            font.weight: Font.Medium
                            wrapMode: Text.Wrap
                            color: Appearance.colors.colOnLayer0
                        }
                        SrsText {
                            Layout.fillWidth: true
                            visible: !!modelData.transcription
                            text: modelData.transcription || ""
                            wrapMode: Text.Wrap
                            color: Appearance.colors.colSubtext
                        }
                        SrsText {
                            Layout.fillWidth: true
                            visible: !!modelData.secondary
                            text: modelData.secondary || ""
                            wrapMode: Text.Wrap
                            color: Appearance.colors.colOnLayer0
                        }
                        SrsText {
                            Layout.fillWidth: true
                            visible: !!modelData.detail
                            text: modelData.detail || ""
                            font.italic: true
                            wrapMode: Text.Wrap
                            color: Appearance.colors.colSubtext
                        }
                    }
                }
            }
        }
        SrsText {
            Layout.fillWidth: true
            visible: !!SrsService.aiError
            text: SrsService.aiError
            textFormat: Text.PlainText
            wrapMode: Text.Wrap
            color: Appearance.colors.colError
        }
    }
    Connections {
        target: SrsService
        function onAiReplyVersionChanged() {
            if (SrsService.aiResultKind === "ai-chat" && root.chatRequestCardId === root.card?.id && root.chatMessages.length) {
                const updated = root.chatMessages.slice();
                updated[updated.length - 1] = {speaker: "ИИ", text: String(SrsService.aiResult || "")};
                root.chatMessages = updated;
                root.chatRequestCardId = -1;
            }
        }
        function onAiErrorChanged() {
            if (SrsService.aiError && root.chatRequestCardId === root.card?.id && root.chatMessages.length && root.chatMessages[root.chatMessages.length - 1].text === "…") {
                root.chatMessages = root.chatMessages.slice(0, -1);
                root.chatRequestCardId = -1;
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
                font.pixelSize: Appearance.font.pixelSize.small
                font.bold: true
                font.letterSpacing: 1
                color: Appearance.colors.colPrimary
            }
        }
        SrsText {
            Layout.fillWidth: true
            text: root.activeSection?.text || ""
            textFormat: Text.StyledText
            font.weight: Font.Normal
            wrapMode: Text.Wrap
            color: Appearance.colors.colOnLayer0
        }
    }
}
