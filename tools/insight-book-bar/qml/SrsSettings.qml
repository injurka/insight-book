import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import qs.modules.common
import qs.modules.common.widgets

ColumnLayout {
    id: root
    spacing: 8
    readonly property var deckChoices: [{id: "all", name: "Все колоды"}, {id: "none", name: "Без колоды"}].concat(SrsService.decks).map(d => Object.assign({icon: ""}, d))
    function values(action) {
        return {action: action, url: url.text, language: language.text, targetLang: target.text, deckId: String(deckChoices[deck.currentIndex]?.id || "all")};
    }
    function submit() {
        const command = values("login");
        command.login = login.text; command.password = password.text;
        SrsService.request(command);
        password.clear();
    }
    Component.onDestruction: password.clear()
    StyledText { text: "Подключение InsightBook"; font.bold: true }
    MaterialTextField {
        id: url
        Layout.fillWidth: true
        text: SrsService.config.url
        placeholderText: "Адрес бека"
        enabled: !SrsService.busy
    }
    RowLayout {
        Layout.fillWidth: true
        MaterialTextField {
            id: language
            Layout.fillWidth: true
            text: SrsService.config.language
            placeholderText: "Язык: all, en, zh…"
            enabled: !SrsService.busy
        }
        MaterialTextField {
            id: target
            Layout.preferredWidth: 100
            text: SrsService.config.targetLang
            placeholderText: "Перевод: ru"
            enabled: !SrsService.busy
        }
    }
    StyledComboBox {
        id: deck
        Layout.fillWidth: true
        model: root.deckChoices
        textRole: "name"
        currentIndex: Math.max(0, root.deckChoices.findIndex(d => String(d.id) === SrsService.config.deckId))
        enabled: !SrsService.busy
    }
    RippleButton {
        Layout.fillWidth: true
        implicitHeight: 38
        enabled: !SrsService.busy
        onClicked: SrsService.request(root.values("configure"))
        StyledText { anchors.centerIn: parent; text: "Применить настройки" }
    }
    MaterialTextField {
        id: login
        Layout.fillWidth: true
        placeholderText: "Логин или email"
        enabled: !SrsService.busy
    }
    MaterialTextField {
        id: password
        Layout.fillWidth: true
        placeholderText: "Пароль"
        echoMode: TextInput.Password
        enabled: !SrsService.busy
        onAccepted: if (login.text && password.text) root.submit()
    }
    RowLayout {
        Layout.fillWidth: true
        RippleButton {
            Layout.fillWidth: true
            implicitHeight: 38
            enabled: !SrsService.busy && !!login.text && !!password.text
            onClicked: root.submit()
            StyledText { anchors.centerIn: parent; text: "Войти" }
        }
        RippleButton {
            Layout.fillWidth: true
            implicitHeight: 38
            enabled: !SrsService.busy && !SrsService.oauthPending
            onClicked: SrsService.request(root.values("oauth-start"))
            StyledText { anchors.centerIn: parent; text: "Войти через Яндекс" }
        }
    }
    RippleButton {
        Layout.fillWidth: true
        implicitHeight: 32
        enabled: !SrsService.busy
        onClicked: SrsService.request({action: "logout"})
        StyledText { anchors.centerIn: parent; text: "Выйти из аккаунта"; color: Appearance.colors.colSubtext }
    }
    StyledText {
        Layout.fillWidth: true
        wrapMode: Text.Wrap
        text: SrsService.oauthPending ? "Заверши вход в браузере. Виджет подключится автоматически." : "Пароль не сохраняется. Сессия хранится локально с доступом только для твоего пользователя."
        color: Appearance.colors.colSubtext
        font.pixelSize: Appearance.font.pixelSize.small
    }
}
