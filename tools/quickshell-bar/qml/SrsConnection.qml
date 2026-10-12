import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import qs.modules.common
import qs.modules.common.widgets

ColumnLayout {
    id: root
    spacing: 16

    function connect() {
        if (!SrsService.busy && !SrsService.oauthPending && url.text.trim())
            SrsService.request({action: "connect", url: url.text.trim()});
    }
    function signIn() {
        if (SrsService.busy || SrsService.oauthPending || !login.text || !password.text) return;
        SrsService.request({action: "login", url: url.text.trim(), login: login.text, password: password.text});
        password.clear();
    }
    Component.onDestruction: password.clear()

    SrsText {
        text: "Подключение"
        font.pixelSize: 20
        font.bold: true
    }
    SrsText {
        Layout.fillWidth: true
        text: "Выбери сервер и способ входа."
        color: Appearance.colors.colSubtext
        font.pixelSize: Appearance.font.pixelSize.small
    }

    SrsSection {
        RowLayout {
            Layout.fillWidth: true
            SrsText {
                Layout.fillWidth: true
                text: "Сервер API"
                font.bold: true
                font.pixelSize: Appearance.font.pixelSize.small
            }
            MaterialSymbol {
                visible: SrsService.connectionChecked
                text: "check_circle"
                iconSize: 18
                color: Appearance.colors.colPrimary
            }
        }
        RowLayout {
            Layout.fillWidth: true
            visible: SrsService.connectionChecked
            SrsText {
                Layout.fillWidth: true
                text: url.text.replace(/^https?:\/\//, "").replace(/\/$/, "")
                elide: Text.ElideMiddle
                font.pixelSize: 12
                color: Appearance.colors.colOnLayer0
            }
            RippleButton {
                implicitWidth: 32
                implicitHeight: 32
                enabled: !SrsService.busy && !SrsService.oauthPending
                onClicked: { SrsService.connectionChecked = false; url.forceActiveFocus(); }
                Accessible.name: "Изменить сервер"
                StyledToolTip { text: "Изменить сервер"; font.family: "Maple Mono"; delay: 500 }
                MaterialSymbol { anchors.centerIn: parent; text: "edit"; iconSize: 18 }
            }
        }
        MaterialTextField {
            id: url
            Layout.fillWidth: true
            visible: !SrsService.connectionChecked
            font.family: "Maple Mono"
            font.variableAxes: ({})
            font.pixelSize: 12
            wrapMode: TextInput.NoWrap
            text: SrsService.config.url
            placeholderText: "https://api.example.com"
            enabled: !SrsService.busy && !SrsService.oauthPending
            onTextEdited: SrsService.connectionChecked = false
            onAccepted: root.connect()
        }
        SrsAction {
            Layout.fillWidth: true
            visible: !SrsService.connectionChecked
            label: "Подключиться"
            primary: true
            enabled: !SrsService.busy && !SrsService.oauthPending && !!url.text.trim()
            onClicked: root.connect()
        }
    }

    SrsSection {
        visible: SrsService.connectionChecked
        SrsText { text: "Аккаунт"; font.bold: true; font.pixelSize: Appearance.font.pixelSize.small }
        MaterialTextField {
            id: login
            Layout.fillWidth: true
            font.family: "Maple Mono"
            font.variableAxes: ({})
            placeholderText: "Логин или email"
            wrapMode: TextInput.NoWrap
            enabled: !SrsService.busy && !SrsService.oauthPending
            onAccepted: password.forceActiveFocus()
        }
        MaterialTextField {
            id: password
            Layout.fillWidth: true
            font.family: "Maple Mono"
            font.variableAxes: ({})
            placeholderText: "Пароль"
            echoMode: TextInput.Password
            wrapMode: TextInput.NoWrap
            enabled: !SrsService.busy && !SrsService.oauthPending
            onAccepted: root.signIn()
        }
        SrsAction {
            Layout.fillWidth: true
            label: "Войти"
            primary: true
            enabled: !!login.text && !!password.text && !SrsService.busy && !SrsService.oauthPending
            onClicked: root.signIn()
        }
        RowLayout {
            Layout.fillWidth: true
            Layout.topMargin: 4
            Layout.bottomMargin: 4
            spacing: 12
            Rectangle { Layout.fillWidth: true; implicitHeight: 1; color: Appearance.colors.colOutlineVariant }
            SrsText { text: "или"; color: Appearance.colors.colSubtext; font.pixelSize: 12 }
            Rectangle { Layout.fillWidth: true; implicitHeight: 1; color: Appearance.colors.colOutlineVariant }
        }
        SrsAction {
            Layout.fillWidth: true
            label: "Войти через Яндекс"
            enabled: !SrsService.busy && !SrsService.oauthPending
            onClicked: SrsService.request({action: "oauth-start", url: url.text.trim()})
        }
        RowLayout {
            Layout.fillWidth: true
            implicitHeight: 28
            spacing: 8
            MaterialSymbol {
                text: SrsService.oauthPending ? "hourglass_top" : "open_in_new"
                iconSize: 16
                color: Appearance.colors.colSubtext
            }
            SrsText {
                Layout.fillWidth: true
                text: SrsService.oauthPending ? "Заверши вход в браузере" : "Авторизация откроется в браузере"
                color: Appearance.colors.colSubtext
                font.pixelSize: 12
                elide: Text.ElideRight
            }
        }
    }
}
