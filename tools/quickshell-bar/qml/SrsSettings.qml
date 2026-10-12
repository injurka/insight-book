import QtQuick
import QtQuick.Layouts
import qs.modules.common
import qs.modules.common.widgets

ColumnLayout {
    id: root

    property var selectedModes: SrsService.config.modes.slice()
    property var selectedDecks: SrsService.config.deckId === "all" ? [] : SrsService.config.deckId.split(",")
    property var selectedLevels: SrsService.config.difficulty === "all" ? [] : SrsService.config.difficulty.split(",")
    readonly property var decks: [{
        "id": "none",
        "name": "Без колоды"
    }].concat(SrsService.catalog.decks)
    readonly property var levels: {
        const ids = root.selectedDecks.length ? root.selectedDecks : ["all"];
        const values = ids.reduce((all, id) => {
            return all.concat(Object.values((SrsService.catalog.levels || {
            })[id] || {
            }).reduce((items, list) => {
                return items.concat(list);
            }, []));
        }, []);
        return [{
            "id": "none",
            "name": "Без сложности"
        }].concat(Array.from(new Set(values)).sort().map((d) => {
            return ({
                "id": d,
                "name": d
            });
        }));
    }

    spacing: 10

    SrsText {
        text: "Настрой тренировку"
        font.pixelSize: 22
        font.bold: true
    }

    RowLayout {
        Layout.fillWidth: true

        SrsText {
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

    SrsSection {
        SrsText {
            text: "Параметры выборки"
            font.bold: true
        }

        RowLayout {
            Layout.fillWidth: true
            spacing: 10

            SrsMultiSelect {
                Layout.fillWidth: true
                title: "Колоды"
                allLabel: "Все колоды"
                options: root.decks
                selected: root.selectedDecks
                enabled: !SrsService.busy
                onSelectionChanged: (values) => {
                    root.selectedDecks = values;
                    root.selectedLevels = root.selectedLevels.filter((id) => {
                        return root.levels.some((l) => {
                            return l.id === id;
                        });
                    });
                }
            }

            SrsMultiSelect {
                Layout.fillWidth: true
                title: "Сложности"
                allLabel: "Все сложности"
                options: root.levels
                selected: root.selectedLevels
                enabled: !SrsService.busy
                onSelectionChanged: (values) => {
                    return root.selectedLevels = values;
                }
            }

        }

    }

    SrsSection {
        SrsText {
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
                    id: modeButton

                    required property var modelData

                    Layout.fillWidth: true
                    implicitHeight: 82
                    toggled: root.selectedModes.includes(modelData.id)
                    colBackground: Appearance.colors.colLayer2
                    colBackgroundToggled: Appearance.colors.colSecondaryContainer
                    colBackgroundToggledHover: Appearance.colors.colSecondaryContainerHover
                    enabled: !SrsService.busy
                    onClicked: root.selectedModes = toggled ? root.selectedModes.filter((m) => {
                        return m !== modelData.id;
                    }) : root.selectedModes.concat([modelData.id])

                    ColumnLayout {
                        anchors.fill: parent
                        anchors.margins: 10
                        spacing: 6

                        RowLayout {
                            Layout.fillWidth: true

                            MaterialSymbol {
                                text: modelData.icon
                                iconSize: 18
                                color: modeButton.toggled ? Appearance.colors.colOnSecondaryContainer : Appearance.colors.colOnLayer0
                            }

                            SrsText {
                                Layout.fillWidth: true
                                text: modelData.name
                                font.bold: true
                                font.pixelSize: Appearance.font.pixelSize.small
                                elide: Text.ElideRight
                                color: modeButton.toggled ? Appearance.colors.colOnSecondaryContainer : Appearance.colors.colOnLayer0
                            }

                            MaterialSymbol {
                                text: modeButton.toggled ? "check_circle" : "radio_button_unchecked"
                                iconSize: 18
                                color: modeButton.toggled ? Appearance.colors.colOnSecondaryContainer : Appearance.colors.colOnLayer0
                            }

                        }

                        SrsText {
                            Layout.fillWidth: true
                            text: modelData.detail
                            wrapMode: Text.Wrap
                            maximumLineCount: 2
                            elide: Text.ElideRight
                            color: modeButton.toggled ? Appearance.colors.colOnSecondaryContainer : Appearance.colors.colSubtext
                            font.pixelSize: 11
                        }

                    }

                }

            }

        }

        SrsText {
            Layout.fillWidth: true
            wrapMode: Text.Wrap
            text: "Выбранные режимы будут чередоваться в случайном порядке."
            color: Appearance.colors.colSubtext
            font.pixelSize: Appearance.font.pixelSize.small
        }

    }

    SrsAction {
        Layout.fillWidth: true
        label: "Начать тренировку"
        primary: true
        enabled: !SrsService.busy && root.selectedModes.length > 0
        onClicked: SrsService.start({
            "deckId": root.selectedDecks.join(",") || "all",
            "difficulty": root.selectedLevels.join(",") || "all",
            "language": "all",
            "targetLang": "ru",
            "modes": root.selectedModes
        })
    }

}
