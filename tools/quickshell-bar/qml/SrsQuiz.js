.pragma library

function normalize(value) {
    return String(value || "").normalize("NFKC").trim().toLocaleLowerCase();
}
function shuffle(values) {
    const result = values.slice();
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}
function choices(card, pool, reverse) {
    const field = reverse ? "word" : "translation";
    const correct = String(card[field] || "");
    const options = [correct];
    for (const candidate of shuffle(pool)) {
        const value = String(candidate[field] || "");
        if (candidate.language !== card.language || !value || options.some(o => normalize(o) === normalize(value))) continue;
        options.push(value);
        if (options.length === 4) break;
    }
    return correct ? shuffle(options) : [];
}
