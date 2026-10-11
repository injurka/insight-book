import QtQuick
import QtQuick.Layouts
import qs.modules.common
import qs.modules.common.widgets

ColumnLayout {
    id: root

    property var selectedModes: SrsService.config.modes.slice()
    readonly property var decks: [{
        "id": "all",
        "name": "Все колоды",
        "icon": ""
    }, {
        "id": "none",
        "name": "Без колоды",
        "icon": ""
    }].concat(SrsService.catalog.decks.map((d) => {
        return Object.assign({
            "icon": ""
        }, d);
    }))
    readonly property var languages: [{
        "id": "all",
        "name": "Все языки",
        "icon": ""
    }].concat(SrsService.catalog.languages.map((id) => {
        return ({
            "id": id,
            "name": ({
                "en": "Английский",
                "zh": "Китайский",
                "ja": "Японский",
                "ko": "Корейский",
                "fr": "Французский",
                "de": "Немецкий",
                "es": "Испанский",
                "ru": "Русский"
            })[id] || id,
            "icon": ""
        });
    }))
    readonly property var levels: {
        const deckId = String(root.decks[deck.currentIndex]?.id || "all");
        const langId = root.languages[language.currentIndex]?.id || "all";
        const groups = (SrsService.catalog.levels || {})[deckId] || {};
        const values = langId === "all" ? Object.values(groups).reduce((all, list) => all.concat(list), []) : groups[langId] || [];
        return [{id: "all", name: "Все сложности", icon: ""}, {id: "none", name: "Без сложности", icon: ""}].concat(Array.from(new Set(values)).sort().map(d => ({id: d, name: d, icon: ""})));
    }
    StyledText {
        text: "Настрой тренировку"
        font.pixelSize: 22
        font.bold: true
    }

    RowLayout {
        Layout.fillWidth: true

        StyledText {
            Layout.fillWidth: true
            text: SrsService.account.username
            color: Appearance.colors.colSubtext
        }

        SrsAction {
            label: "Выйти"
            implicitHeight: 32
            enabled: !SrsService.busy
            onClicked: SrsService.request({
                "action": "logout"
            })
        }

    }

    StyledText {
        text: "Параметры выборки"
        font.bold: true
    }

    RowLayout {
        Layout.fillWidth: true

        ColumnLayout {
            Layout.fillWidth: true

            StyledText {
                text: "Колода"
                color: Appearance.colors.colSubtext
                font.pixelSize: Appearance.font.pixelSize.small
            }

            StyledComboBox {
                id: deck

                Layout.fillWidth: true
                model: root.decks
                textRole: "name"
                currentIndex: Math.max(0, root.decks.findIndex((d) => {
                    return String(d.id) === SrsService.config.deckId;
                }))
                enabled: !SrsService.busy
            }

        }

        ColumnLayout {
            Layout.fillWidth: true

            StyledText {
                text: "Сложность"
                color: Appearance.colors.colSubtext
                font.pixelSize: Appearance.font.pixelSize.small
            }

            StyledComboBox {
                id: difficulty

                Layout.fillWidth: true
                model: root.levels
                textRole: "name"
                currentIndex: Math.max(0, root.levels.findIndex((d) => {
                    return d.id === SrsService.config.difficulty;
                }))
                enabled: !SrsService.busy
            }

        }

    }

    RowLayout {
        Layout.fillWidth: true

        ColumnLayout {
            Layout.fillWidth: true
            StyledText {
                text: "Язык слов"
                color: Appearance.colors.colSubtext
                font.pixelSize: Appearance.font.pixelSize.small
            }
            StyledComboBox {
                id: language
                Layout.fillWidth: true
                model: root.languages
                textRole: "name"
                currentIndex: Math.max(0, root.languages.findIndex((d) => d.id === SrsService.config.language))
                enabled: !SrsService.busy
            }
        }
        ColumnLayout {
            Layout.preferredWidth: 100
            StyledText {
                text: "Перевод"
                color: Appearance.colors.colSubtext
                font.pixelSize: Appearance.font.pixelSize.small
            }
            MaterialTextField {
                id: target
                Layout.fillWidth: true
                text: SrsService.config.targetLang
                placeholderText: "ru"
                enabled: !SrsService.busy
            }
        }

    }

    Rectangle {
        Layout.fillWidth: true
        implicitHeight: 1
        color: Appearance.colors.colOutlineVariant
    }

    StyledText {
        text: "Режимы тренировки"
        font.bold: true
    }

    GridLayout {
        Layout.fillWidth: true
        columns: 2
        columnSpacing: 8
        rowSpacing: 8

        Repeater {
            model: [{
                "id": "standard",
                "name": "Чтение",
                "detail": "Классические карточки",
                "icon": "article"
            }, {
                "id": "typing",
                "name": "Ввод",
                "detail": "Написать слово по памяти",
                "icon": "keyboard"
            }, {
                "id": "choice",
                "name": "Тест",
                "detail": "Выбрать перевод",
                "icon": "checklist"
            }, {
                "id": "choice-reverse",
                "name": "Обратный тест",
                "detail": "Вспомнить слово по переводу",
                "icon": "swap_horiz"
            }, {
                "id": "audio",
                "name": "Аудирование",
                "detail": "Распознать слово на слух",
                "icon": "headphones"
            }]

            delegate: RippleButton {
                required property var modelData

                Layout.fillWidth: true
                implicitHeight: 88
                toggled: root.selectedModes.includes(modelData.id)
                colBackground: Appearance.colors.colLayer1
                colBackgroundToggled: Appearance.colors.colSecondaryContainer
                colBackgroundToggledHover: Appearance.colors.colSecondaryContainerHover
                enabled: !SrsService.busy
                onClicked: root.selectedModes = toggled ? root.selectedModes.filter((m) => {
                    return m !== modelData.id;
                }) : root.selectedModes.concat([modelData.id])

                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: 12
                    spacing: 4

                    RowLayout {
                        Layout.fillWidth: true

                        MaterialSymbol {
                            text: modelData.icon
                            iconSize: 20
                        }

                        Item {
                            Layout.fillWidth: true
                        }

                        MaterialSymbol {
                            text: parent.parent.parent.toggled ? "check_circle" : "radio_button_unchecked"
                            iconSize: 18
                        }

                    }

                    StyledText {
                        text: modelData.name
                        font.bold: true
                        font.pixelSize: Appearance.font.pixelSize.small
                    }

                    StyledText {
                        Layout.fillWidth: true
                        text: modelData.detail
                        wrapMode: Text.Wrap
                        color: Appearance.colors.colSubtext
                        font.pixelSize: 11
                    }

                }

            }

        }

    }

    StyledText {
        Layout.fillWidth: true
        wrapMode: Text.Wrap
        text: root.selectedModes.length > 1 ? "Выбранные режимы будут чередоваться в случайном порядке." : "Выбери один или несколько режимов."
        color: Appearance.colors.colSubtext
        font.pixelSize: Appearance.font.pixelSize.small
    }

    SrsAction {
        Layout.fillWidth: true
        label: "Начать тренировку"
        primary: true
        enabled: !SrsService.busy && root.selectedModes.length > 0
        onClicked: SrsService.start({
            "deckId": String(root.decks[deck.currentIndex]?.id || "all"),
            "difficulty": root.levels[difficulty.currentIndex]?.id || "all",
            "language": root.languages[language.currentIndex].id,
            "targetLang": target.text || "ru",
            "modes": root.selectedModes
        })
    }

}
