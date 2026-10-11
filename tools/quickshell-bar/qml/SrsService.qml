pragma Singleton
import QtQuick
import Quickshell
import Quickshell.Io

Singleton {
    id: root
    property var config: ({url: "https://insight-book-api.limited-dissolve.ru", language: "all", targetLang: "ru", deckId: "all", difficulty: "all", modes: ["standard"]})
    property var account: ({authenticated: false, username: "", renewable: false})
    property var catalog: ({decks: [], languages: [], levels: ({}), pool: []})
    property var cards: []
    property int count: 0
    property int reviewed: 0
    property bool ready: false
    property bool busy: process.running
    property bool paused: false
    property bool authRequired: false
    property bool connectionChecked: false
    property bool oauthPending: false
    property int oauthPolls: 0
    property string stage: "connect"
    property string error: ""
    property string pendingInput: ""
    property string action: ""
    property string audioUrl: ""
    readonly property var card: cards.length ? cards[0] : null
    signal showPopup(string screenName)
    signal cardReviewed(int wordId)

    IpcHandler {
        target: "quickshellBar"
        function open(screen: string): void { root.showPopup(screen); }
        function status(): string { return JSON.stringify({stage: root.stage, authenticated: root.account.authenticated, ready: root.ready, count: root.count, error: root.error, busy: root.busy}); }
    }
    function request(command) {
        if (busy) return;
        action = command.action || "refresh";
        if (["connect", "login", "logout"].includes(action)) { cards = []; count = 0; ready = false; }
        pendingInput = JSON.stringify(command) + "\n";
        error = "";
        process.running = true;
    }
    function refresh() {
        if (stage === "training") request({action: "refresh"});
        else if (!account.authenticated) request({action: "bootstrap"});
    }
    function start(options) { cards = []; count = 0; ready = false; request(Object.assign({action: "configure"}, options)); }
    function review(grade) { if (card && !error && account.authenticated) request({action: "review", wordId: card.id, grade: grade}); }
    function playAudio() { if (card && !busy) request({action: "audio", text: card.word}); }
    function receive(output) {
        try {
            const result = JSON.parse(output);
            if (result.config) config = result.config;
            if (result.reviewedId) {
                reviewed++; cards = cards.filter(c => c.id !== result.reviewedId); count = Math.max(0, count - 1);
                cardReviewed(result.reviewedId);
            }
            if (result.authenticated !== undefined) account = {authenticated: result.authenticated, username: result.user?.username || "", renewable: !!result.renewable};
            if (result.oauthPending !== undefined) { oauthPending = result.oauthPending; if (action === "oauth-start") oauthPolls = 0; }
            if (action === "connect" && (result.authRequired || result.authenticated)) connectionChecked = true;
            if (result.loggedOut || result.authRequired) {
                stage = "connect"; cards = []; count = 0; ready = false; authRequired = true;
                account = {authenticated: false, username: "", renewable: false};
            }
            if (!result.ok) {
                // Needing credentials after selecting a server is a normal step.
                error = result.authRequired && ["bootstrap", "connect"].includes(action) ? "" : result.error || "Не удалось обновить очередь.";
                return;
            }
            if (result.loggedOut) { connectionChecked = true; oauthPending = false; error = result.warning || ""; return; }
            if (result.decks) catalog = {decks: result.decks, languages: result.languages, levels: result.levels, pool: result.pool};
            if (result.cards !== undefined) { cards = result.cards; count = result.count; ready = true; authRequired = false; }
            if (result.audioUrl) audioUrl = result.audioUrl;
            if (["bootstrap", "connect", "login", "oauth-poll"].includes(action) && result.authenticated) { stage = "setup"; connectionChecked = true; }
            if (action === "configure") { stage = "training"; reviewed = 0; }
        } catch (e) { error = "Не удалось прочитать ответ помощника."; }
    }
    Component.onCompleted: request({action: "bootstrap"})
    Process {
        id: process
        command: ["python3", Quickshell.shellPath("scripts/quickshellBar/bridge.py")]
        stdinEnabled: true
        onStarted: { process.write(root.pendingInput); root.pendingInput = ""; }
        stdout: StdioCollector { onStreamFinished: root.receive(text) }
        onExited: (code, status) => { root.pendingInput = ""; if (code !== 0 && !root.error) root.error = "Не удалось выполнить запрос. Попробуй ещё раз."; }
    }
    Timer {
        interval: 55000; running: root.busy
        onTriggered: { process.running = false; root.pendingInput = ""; root.error = "Сервер не ответил вовремя. Обнови очередь перед следующей оценкой."; }
    }
    Timer {
        interval: 60000; repeat: true; running: true
        onTriggered: if (!root.paused && !root.busy && root.account.authenticated && root.stage === "training" && !root.oauthPending) root.refresh()
    }
    Timer {
        interval: 3000; repeat: true; running: root.oauthPending
        onTriggered: {
            if (root.busy) return;
            if (++root.oauthPolls > 200) { root.oauthPending = false; root.error = "Время ожидания входа истекло. Попробуй ещё раз."; return; }
            root.request({action: "oauth-poll"});
        }
    }
}
