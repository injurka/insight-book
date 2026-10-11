import QtQuick
import Quickshell
import Quickshell.Io
pragma Singleton

Singleton {
    id: root

    property var config: ({
        "url": "https://insight-book-api.limited-dissolve.ru",
        "language": "all",
        "targetLang": "ru",
        "deckId": "all"
    })
    property var cards: []
    property var decks: []
    property int reviewed: 0
    property int count: 0
    property bool ready: false
    property bool busy: process.running
    property bool paused: false
    property bool authRequired: false
    property bool oauthPending: false
    property int oauthPolls: 0
    property bool metadataPending: false
    property bool metadataLoaded: false
    property string error: ""
    property string pendingInput: ""
    property string action: ""
    readonly property var card: cards.length ? cards[0] : null

    signal showPopup(string screenName)
    signal authenticated()

    IpcHandler {
        target: "insightBook"
        function open(screen: string): void { root.showPopup(screen); }
        function status(): string { return JSON.stringify({ready: root.ready, count: root.count, authRequired: root.authRequired, error: root.error, busy: root.busy}); }
    }

    function request(command) {
        if (busy)
            return ;

        action = command.action || "refresh";
        if (["configure", "login", "logout", "oauth-start"].includes(action)) {
            metadataPending = false;
            metadataLoaded = false;
            cards = []; decks = []; count = 0; ready = false;
        }
        pendingInput = JSON.stringify(command) + "\n";
        error = "";
        process.running = true;
    }

    function refresh() {
        request({
            "action": "refresh"
        });
    }

    function review(grade) {
        if (card && !error && !authRequired)
            request({
            "action": "review",
            "wordId": card.id,
            "grade": grade
        });

    }

    function receive(output) {
        try {
            const result = JSON.parse(output);
            if (result.config)
                config = result.config;

            if (result.reviewedId) {
                reviewed++;
                cards = cards.filter((c) => {
                    return c.id !== result.reviewedId;
                });
                count = Math.max(0, count - 1);
            }
            if (result.loggedOut) {
                cards = [];
                decks = [];
                count = 0;
                ready = false;
                authRequired = true;
                oauthPending = false;
                return ;
            }
            if (result.oauthPending !== undefined) {
                oauthPending = result.oauthPending;
                if (action === "oauth-start")
                    oauthPolls = 0;

            }
            if (!result.ok) {
                error = result.error || "Не удалось обновить очередь.";
                authRequired = !!result.authRequired;
                if (authRequired) {
                    cards = [];
                    count = 0;
                    ready = false;
                }
                return ;
            }
            if (result.cards !== undefined) {
                cards = result.cards;
                count = result.count;
                ready = true;
                authRequired = false;
                if (["configure", "login", "oauth-poll"].includes(action) || !metadataLoaded)
                    metadataPending = true;

            }
            if (result.decks) {
                decks = result.decks;
                metadataLoaded = true;
            }
            if (result.cards !== undefined && ["login", "oauth-poll"].includes(action)) authenticated();

            if (action === "oauth-poll" && result.cards !== undefined)
                oauthPending = false;

        } catch (e) {
            error = "Не удалось прочитать ответ помощника.";
        }
    }

    Component.onCompleted: refresh()

    Process {
        id: process

        command: ["python3", Quickshell.shellPath("scripts/insightBook/bridge.py")]
        stdinEnabled: true
        onStarted: {
            process.write(root.pendingInput);
            root.pendingInput = "";
        }
        onExited: (code, status) => {
            root.pendingInput = "";
            if (code !== 0 && !root.error)
                root.error = "Помощник завершился с ошибкой. Обнови очередь.";

        }

        stdout: StdioCollector {
            onStreamFinished: root.receive(text)
        }

    }

    Timer {
        interval: 45000
        running: root.busy
        onTriggered: {
            process.running = false;
            root.pendingInput = "";
            root.error = "Сервер не ответил вовремя. Обнови очередь перед следующей оценкой.";
        }
    }

    Timer {
        interval: 60000
        repeat: true
        running: true
        onTriggered: {
            if (!root.paused && !root.busy && !root.authRequired && !root.oauthPending) {
                root.refresh();
            }
        }
    }

    Timer {
        interval: 50
        running: root.metadataPending && !root.busy && !root.oauthPending
        onTriggered: {
            root.metadataPending = false;
            root.request({
                "action": "metadata"
            });
        }
    }

    Timer {
        interval: 3000
        repeat: true
        running: root.oauthPending
        onTriggered: {
            if (root.busy)
                return ;

            if (++root.oauthPolls > 200) {
                root.oauthPending = false;
                root.error = "Время ожидания входа истекло. Нажми «Войти через Яндекс» ещё раз.";
                return ;
            }
            root.request({
                "action": "oauth-poll"
            });
        }
    }

}
