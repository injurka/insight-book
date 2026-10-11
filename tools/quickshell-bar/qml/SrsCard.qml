import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtMultimedia
import qs.modules.common
import qs.modules.common.widgets
import "SrsQuiz.js" as Quiz

ColumnLayout {
    id: root
    spacing: 16
    property bool revealed: false
    property string feedback: ""
    property string mode: "standard"
    property var options: []
    property int cardId: -1
    readonly property var card: SrsService.card
    readonly property string correct: mode === "choice-reverse" ? card?.word || "" : card?.translation || ""
    onCardChanged: reset()
    Component.onCompleted: reset()
    function reset() {
        if ((card?.id || -1) === cardId) return;
        cardId = card?.id || -1;
        revealed = false; feedback = ""; input.clear(); player.stop();
        if (!card) return;
        const modes = SrsService.config.modes;
        mode = modes[Math.floor(Math.random() * modes.length)] || "standard";
        options = Quiz.choices(card, SrsService.catalog.pool, mode === "choice-reverse");
        if (["choice", "choice-reverse", "audio"].includes(mode) && options.length < 2) {
            mode = "standard"; feedback = "Для теста нужно хотя бы два разных ответа в словаре. Покажу карточку для чтения.";
        }
    }
    function choose(value) {
        feedback = Quiz.normalize(value) === Quiz.normalize(correct) ? "Верно" : "Правильный ответ: " + correct;
        revealed = true;
    }
    function checkInput() {
        feedback = Quiz.normalize(input.text) === Quiz.normalize(card.word) ? "Верно" : "Правильный ответ: " + card.word;
        revealed = true;
    }
    function key(event) {
        if (!card || SrsService.busy || SrsService.error) return;
        if (event.key === Qt.Key_Space && mode === "standard" && !revealed) { revealed = true; event.accepted = true; }
        else if (event.key >= Qt.Key_1 && event.key <= Qt.Key_4) {
            const index = event.key - Qt.Key_1;
            if (revealed) SrsService.review(index + 1);
            else if (["choice", "choice-reverse", "audio"].includes(mode) && options[index]) choose(options[index]);
            else return;
            event.accepted = true;
        }
    }
    StyledText {
        Layout.fillWidth: true
        text: card ? ({standard: "Чтение", typing: "Ввод", choice: "Тест", "choice-reverse": "Обратный тест", audio: "Аудирование"})[root.mode] : "Тренировка завершена"
        color: Appearance.colors.colSubtext; font.pixelSize: Appearance.font.pixelSize.small
    }
    StyledText {
        Layout.fillWidth: true; horizontalAlignment: Text.AlignHCenter; wrapMode: Text.Wrap; textFormat: Text.PlainText
        text: !root.card ? "На сейчас всё повторено ✨" : root.mode === "audio" && !root.revealed ? "Послушай и выбери перевод" : ["typing", "choice-reverse"].includes(root.mode) && !root.revealed ? root.card.translation || "Перевод не указан" : root.card.word
        font.pixelSize: root.card && root.mode !== "audio" ? 28 : 21
    }
    StyledText {
        Layout.fillWidth: true; horizontalAlignment: Text.AlignHCenter; textFormat: Text.PlainText; wrapMode: Text.Wrap
        visible: !!root.card?.transcription && (root.mode === "standard" || root.revealed)
        text: root.card?.transcription || ""; color: Appearance.colors.colSubtext
    }
    SrsAction {
        Layout.fillWidth: true; visible: root.mode === "audio" && !!root.card
        label: "Послушать слово"; enabled: !SrsService.busy
        onClicked: SrsService.playAudio()
    }
    RowLayout {
        Layout.fillWidth: true; visible: root.mode === "typing" && !!root.card && !root.revealed
        MaterialTextField { id: input; Layout.fillWidth: true; placeholderText: "Напиши слово"; enabled: !SrsService.busy; onAccepted: if (text) root.checkInput() }
        SrsAction { label: "Проверить"; enabled: !!input.text && !SrsService.busy; onClicked: root.checkInput() }
    }
    ColumnLayout {
        Layout.fillWidth: true
        visible: ["choice", "choice-reverse", "audio"].includes(root.mode) && !!root.card && !root.revealed
        Repeater {
            model: root.options
            delegate: SrsAction {
                required property string modelData
                required property int index
                Layout.fillWidth: true
                implicitHeight: answer.implicitHeight + 24
                enabled: !SrsService.busy && !SrsService.error
                onClicked: root.choose(modelData)
                contentItem: StyledText {
                    id: answer
                    text: (index + 1) + ". " + modelData; wrapMode: Text.Wrap; textFormat: Text.PlainText
                    font.pixelSize: Appearance.font.pixelSize.small
                }
            }
        }
    }
    SrsAction {
        Layout.fillWidth: true; label: "Показать перевод · Пробел"; primary: true
        visible: root.mode === "standard" && !!root.card && !root.revealed
        enabled: !SrsService.busy && !SrsService.error; onClicked: root.revealed = true
    }
    StyledText {
        Layout.fillWidth: true; visible: root.revealed && !!root.card
        text: root.card?.translation || "Перевод не указан"; textFormat: Text.PlainText; wrapMode: Text.Wrap
        horizontalAlignment: Text.AlignHCenter; font.pixelSize: 20
    }
    StyledText {
        Layout.fillWidth: true; visible: !!root.feedback
        text: root.feedback; wrapMode: Text.Wrap; textFormat: Text.PlainText; color: Appearance.colors.colSubtext
        font.pixelSize: Appearance.font.pixelSize.small
    }
    ColumnLayout {
        Layout.fillWidth: true; visible: root.revealed && !!root.card
        StyledText { text: "Как хорошо помнишь слово?"; font.pixelSize: Appearance.font.pixelSize.small; color: Appearance.colors.colSubtext }
        RowLayout {
            Layout.fillWidth: true; spacing: 6
            Repeater {
                model: ["Снова", "Трудно", "Хорошо", "Легко"]
                delegate: SrsAction {
                    required property string modelData
                    required property int index
                    Layout.fillWidth: true; label: modelData + " · " + (index + 1)
                    enabled: !SrsService.busy && !SrsService.error
                    onClicked: SrsService.review(index + 1)
                }
            }
        }
    }
    StyledText {
        Layout.fillWidth: true
        text: "Осталось: " + SrsService.count + " · Повторено: " + SrsService.reviewed
        color: Appearance.colors.colSubtext; font.pixelSize: Appearance.font.pixelSize.small
    }
    SrsAction {
        Layout.fillWidth: true; visible: !root.card; label: "Настроить другую тренировку"; primary: true
        onClicked: SrsService.stage = "setup"
    }
    Connections { target: SrsService; function onAudioUrlChanged() { player.source = SrsService.audioUrl; player.play(); } }
    MediaPlayer { id: player; audioOutput: AudioOutput {}
        onErrorOccurred: (error, text) => root.feedback = "Не удалось воспроизвести озвучку. Попробуй ещё раз." }
}
