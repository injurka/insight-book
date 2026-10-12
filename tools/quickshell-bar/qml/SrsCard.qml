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
        feedback = Quiz.normalize(value) === Quiz.normalize(correct) ? "" : "Правильный ответ: " + correct;
        revealed = true;
    }
    function checkInput() {
        feedback = Quiz.normalize(input.text) === Quiz.normalize(card.word) ? "" : "Правильный ответ: " + card.word;
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
    SrsText {
        Layout.fillWidth: true
        text: card ? ({standard: "Чтение", typing: "Ввод", choice: "Тест", "choice-reverse": "Обратный тест", audio: "Аудирование"})[root.mode] : "Тренировка завершена"
        color: Appearance.colors.colSubtext; font.pixelSize: Appearance.font.pixelSize.small
    }
    Item {
        objectName: "cardFront"
        Layout.fillWidth: true
        Layout.fillHeight: true
        Layout.minimumHeight: implicitHeight
        implicitHeight: wordContent.implicitHeight
        ColumnLayout {
            id: wordContent
            anchors.verticalCenter: parent.verticalCenter
            width: parent.width
            spacing: root.spacing
            SrsText {
                Layout.fillWidth: true; horizontalAlignment: Text.AlignHCenter; wrapMode: Text.Wrap; textFormat: Text.PlainText
                text: !root.card ? "На сейчас всё повторено ✨" : root.mode === "audio" && !root.revealed ? "Послушай и выбери перевод" : ["typing", "choice-reverse"].includes(root.mode) && !root.revealed ? root.card.translation || "Перевод не указан" : root.card.word
                font.pixelSize: root.card && root.mode !== "audio" ? 28 : 21
            }
            SrsText {
                Layout.fillWidth: true; horizontalAlignment: Text.AlignHCenter; textFormat: Text.PlainText; wrapMode: Text.Wrap
                visible: !!root.card?.transcription && (root.mode === "standard" || root.revealed)
                text: root.card?.transcription || ""; color: Appearance.colors.colSubtext
            }
        }
    }
    SrsAction {
        Layout.fillWidth: true; visible: root.mode === "audio" && !!root.card && !root.revealed
        label: "Послушать слово"; enabled: !SrsService.busy
        onClicked: SrsService.playAudio()
    }
    RowLayout {
        Layout.fillWidth: true; visible: root.mode === "typing" && !!root.card && !root.revealed
        MaterialTextField {
            font.family: "Maple Mono"
            font.variableAxes: ({})
            id: input; Layout.fillWidth: true; placeholderText: "Напиши слово"; enabled: !SrsService.busy; onAccepted: if (text) root.checkInput() }
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
                contentItem: SrsText {
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
    SrsText {
        Layout.fillWidth: true; visible: root.revealed && !!root.card
        text: root.card?.translation || "Перевод не указан"; textFormat: Text.PlainText; wrapMode: Text.Wrap
        horizontalAlignment: Text.AlignHCenter; font.pixelSize: 20
    }
    SrsText {
        Layout.fillWidth: true
        visible: root.revealed && !!root.card?.sentence
        text: root.card?.sentence || ""
        textFormat: Text.PlainText
        wrapMode: Text.Wrap
        maximumLineCount: 3
        elide: Text.ElideRight
        color: Appearance.colors.colSubtext
        font.italic: true
    }
    SrsCardToolbar {
        Layout.fillWidth: true
        visible: root.revealed && !!root.card
        card: root.card
    }
    SrsText {
        Layout.fillWidth: true; visible: !!root.feedback
        text: root.feedback; wrapMode: Text.Wrap; textFormat: Text.PlainText; color: Appearance.colors.colSubtext
        font.pixelSize: Appearance.font.pixelSize.small
    }
    ColumnLayout {
        Layout.fillWidth: true; visible: root.revealed && !!root.card
        RowLayout {
            Layout.fillWidth: true; spacing: 6
            Repeater {
                model: ["Снова", "Трудно", "Хорошо", "Легко"]
                delegate: SrsGradeButton {
                    required property string modelData
                    required property int index
                    grade: index + 1
                    label: modelData
                    enabled: !SrsService.busy && !SrsService.error
                    onClicked: SrsService.review(index + 1)
                }
            }
        }
    }
    SrsText {
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
