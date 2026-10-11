import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import qs.modules.common
import qs.modules.common.widgets

ColumnLayout {
    id: root

    function signIn() {
        SrsService.request({
            "action": "login",
            "url": url.text,
            "login": login.text,
            "password": password.text
        });
        password.clear();
    }

    spacing: 14
    Component.onDestruction: password.clear()

    StyledText {
        text: "Подключи InsightBook"
        font.pixelSize: 22
        font.bold: true
    }

    StyledText {
        Layout.fillWidth: true
        wrapMode: Text.Wrap
        text: "Выбери сервер, затем войди в свой аккаунт."
        color: Appearance.colors.colSubtext
    }

    StyledText {
        text: "Сервер API"
        font.pixelSize: Appearance.font.pixelSize.small
    }

    RowLayout {
        Layout.fillWidth: true

        MaterialTextField {
            id: url

            Layout.fillWidth: true
            text: SrsService.config.url
            placeholderText: "https://…"
            enabled: !SrsService.busy && !SrsService.oauthPending
            onTextEdited: SrsService.connectionChecked = false
            onAccepted: {
                if (!SrsService.busy)
                    SrsService.request({
                    "action": "connect",
                    "url": text
                });

            }
        }

        SrsAction {
            label: SrsService.connectionChecked ? "Изменить" : "Далее"
            enabled: !SrsService.busy && !SrsService.oauthPending && !!url.text
            primary: !SrsService.connectionChecked
            onClicked: {
                if (SrsService.connectionChecked)
                    SrsService.connectionChecked = false;
                else
                    SrsService.request({
                    "action": "connect",
                    "url": url.text
                });
            }
        }

    }

    ColumnLayout {
        Layout.fillWidth: true
        visible: SrsService.connectionChecked
        spacing: 12

        Rectangle {
            Layout.fillWidth: true
            implicitHeight: 1
            color: Appearance.colors.colOutlineVariant
        }

        StyledText {
            text: "Вход в аккаунт"
            font.bold: true
        }

        MaterialTextField {
            id: login

            Layout.fillWidth: true
            placeholderText: "Логин или email"
            enabled: !SrsService.busy && !SrsService.oauthPending
        }

        MaterialTextField {
            id: password

            Layout.fillWidth: true
            placeholderText: "Пароль"
            echoMode: TextInput.Password
            enabled: !SrsService.busy && !SrsService.oauthPending
            onAccepted: {
                if (login.text && text && !SrsService.busy)
                    root.signIn();

            }
        }

        SrsAction {
            Layout.fillWidth: true
            label: "Войти"
            primary: true
            enabled: !!login.text && !!password.text && !SrsService.busy && !SrsService.oauthPending
            onClicked: root.signIn()
        }

        StyledText {
            Layout.alignment: Qt.AlignHCenter
            text: "или"
            color: Appearance.colors.colSubtext
            font.pixelSize: Appearance.font.pixelSize.small
        }

        SrsAction {
            Layout.fillWidth: true
            label: SrsService.oauthPending ? "Ожидаю вход в браузере…" : "Войти через Яндекс"
            enabled: !SrsService.busy && !SrsService.oauthPending
            onClicked: SrsService.request({
                "action": "oauth-start",
                "url": url.text
            })
        }

    }

}
