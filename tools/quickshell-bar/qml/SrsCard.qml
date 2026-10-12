import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtMultimedia
import qs.modules.common
import qs.modules.common.widgets
import "SrsQuiz.js" as Quiz
import "SrsIntervals.js" as Schedule

ColumnLayout {
    id: root
    spacing: 16
    property bool revealed: false
    property string feedback: ""
    property string mode: "standard"
    property var options: []
    property int cardId: -1
    readonly property var card: SrsService.card
    readonly property var intervals: card ? Schedule.intervals(card) : []
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
    RowLayout {
        Layout.fillWidth: true
        spacing: 12
        SrsText {
            Layout.fillWidth: true
            Layout.minimumWidth: 0
            elide: Text.ElideRight
            text: root.card ? ({standard: "Чтение", typing: "Ввод", choice: "Тест", "choice-reverse": "Обратный тест", audio: "Аудирование"})[root.mode] : "Тренировка завершена"
            color: Appearance.colors.colSubtext
            font.pixelSize: Appearance.font.pixelSize.small * 0.85
        }
        SrsText {
            Layout.alignment: Qt.AlignRight
            text: "Осталось: " + SrsService.count + " · Повторено: " + SrsService.reviewed
            color: Appearance.colors.colSubtext
            font.pixelSize: Appearance.font.pixelSize.small * 0.85
        }
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
    ColumnLayout {
        Layout.fillWidth: true
        visible: root.revealed && !!root.card
        spacing: root.spacing / 2
        Rectangle {
            Layout.fillWidth: true
            visible: root.revealed && !!root.card
            implicitHeight: translation.implicitHeight + 24
            radius: Appearance.rounding.small
            color: Qt.rgba(Appearance.colors.colPrimary.r, Appearance.colors.colPrimary.g, Appearance.colors.colPrimary.b, 0.04)
            Rectangle {
                anchors.left: parent.left; anchors.top: parent.top; anchors.bottom: parent.bottom
                width: 4; radius: 2; color: Appearance.colors.colPrimary
            }
            SrsText {
                id: translation
                anchors.left: parent.left; anchors.right: parent.right; anchors.verticalCenter: parent.verticalCenter
                anchors.leftMargin: 20; anchors.rightMargin: 16
                text: root.card?.translation || "Перевод не указан"
                textFormat: Text.PlainText; wrapMode: Text.Wrap; font.pixelSize: 15
            }
        }
        Rectangle {
            Layout.fillWidth: true
            visible: root.revealed && !!root.card?.sentence
            implicitHeight: sentence.implicitHeight + 28
            radius: Appearance.rounding.small
            color: Appearance.colors.colLayer1
            MaterialSymbol {
                id: quoteIcon
                anchors.left: parent.left; anchors.top: parent.top
                anchors.leftMargin: 16; anchors.topMargin: 14
                text: "format_quote"; iconSize: 20; color: Appearance.colors.colSubtext
            }
            SrsText {
                id: sentence
                font.pixelSize: Appearance.font.pixelSize.small * 0.85
                anchors.left: quoteIcon.right; anchors.right: parent.right; anchors.verticalCenter: parent.verticalCenter
                anchors.leftMargin: 12; anchors.rightMargin: 16
                text: root.card?.sentence || ""
                textFormat: Text.PlainText; wrapMode: Text.Wrap
                color: Appearance.colors.colSubtext
                onLineLaidOut: line => {
                    line.width = Math.max(0, sentence.width - sentenceAudio.width - 4);
                    if (line.isLast) {
                        sentenceAudio.x = line.x + line.implicitWidth + 4;
                        sentenceAudio.y = line.y + (line.height - sentenceAudio.height) / 2;
                    }
                }
                RippleButton {
                    id: sentenceAudio
                    width: 24; height: 24
                    enabled: !SrsService.busy
                    colBackground: "transparent"
                    colBackgroundHover: Appearance.colors.colLayer1Hover
                    onClicked: SrsService.playSentenceAudio()
                    Accessible.name: "Послушать цитату целиком"
                    StyledToolTip { font.family: "Maple Mono"; font.variableAxes: ({}); text: "Послушать цитату целиком"; delay: 500 }
                    MaterialSymbol {
                        anchors.centerIn: parent
                        text: "volume_up"; iconSize: 16
                        color: Appearance.colors.colSubtext
                    }
                }
            }
        }
        SrsCardToolbar {
            Layout.fillWidth: true
            visible: root.revealed && !!root.card
            card: root.card
        }
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
                    interval: root.intervals[index] || ""
                    enabled: !SrsService.busy && !SrsService.error
                    onClicked: SrsService.review(index + 1)
                }
            }
        }
    }
    SrsAction {
        Layout.fillWidth: true; visible: !root.card; label: "Настроить другую тренировку"; primary: true
        onClicked: SrsService.stage = "setup"
    }
    Connections { target: SrsService; function onAudioUrlChanged() { player.source = SrsService.audioUrl; player.play(); } }
    MediaPlayer { id: player; audioOutput: AudioOutput {}
        onErrorOccurred: (error, text) => root.feedback = "Не удалось воспроизвести озвучку. Попробуй ещё раз." }
}
