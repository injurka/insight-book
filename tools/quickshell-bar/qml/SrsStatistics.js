.pragma library

function summary(data) {
    const days = (data?.heatmap || []).filter(d => d.count > 0).slice().sort((a, b) => a.date.localeCompare(b.date));
    let total = 0, streak = 0, longest = 0, previous = null;
    for (const day of days) {
        const date = Date.parse(day.date + "T12:00:00Z");
        total += day.count;
        streak = previous !== null && Math.round((date - previous) / 86400000) === 1 ? streak + 1 : 1;
        longest = Math.max(longest, streak);
        previous = date;
    }
    return [
        {label: "Всего действий", value: total},
        {label: "Макс. серия дней", value: longest},
        {label: "Прочитано страниц", value: data?.readPages || 0},
        {label: "Выучено слов", value: data?.learnedWords || 0}
    ];
}

function achievements(data) {
    const totals = {};
    for (const item of data?.difficulties || []) totals[item.language] = (totals[item.language] || 0) + item.count;
    const ranks = ["Новичок", "Искатель", "Ученик", "Знаток", "Опытный", "Эксперт", "Мастер", "Полиглот"];
    const targets = [50, 150, 300, 500, 1000, 3000, 5000, 10000];
    const languageNames = {
        en: "Английский",
        zh: "Китайский",
        ja: "Японский",
        ko: "Корейский",
        ru: "Русский",
        es: "Испанский",
        fr: "Французский",
        de: "Немецкий",
        it: "Итальянский",
        pt: "Португальский",
        ar: "Арабский",
        tr: "Турецкий"
    };
    return Object.keys(totals).sort().map(language => {
        const count = totals[language];
        let rank = 0;
        for (let i = 1; i < ranks.length; i++) if (count >= targets[i - 1]) rank = i;
        const next = Math.min(rank + 1, ranks.length - 1);
        const languageCode = String(language).toLowerCase().split(/[-_]/)[0];
        return {language: languageNames[languageCode] || String(language).toUpperCase(), rank: ranks[rank], next: rank < ranks.length - 1 ? ranks[next] : "Максимальный уровень", count: count, target: targets[next], remaining: Math.max(0, targets[next] - count), completed: rank === ranks.length - 1, progress: rank === ranks.length - 1 ? 1 : Math.min(1, count / targets[next])};
    });
}

function wordForm(count) {
    const lastHundred = Math.abs(count) % 100;
    if (lastHundred >= 11 && lastHundred <= 14) return "слов";
    const lastDigit = lastHundred % 10;
    if (lastDigit === 1) return "слово";
    if (lastDigit >= 2 && lastDigit <= 4) return "слова";
    return "слов";
}

function dateRange(days) {
    if (!days?.length) return "";
    const months = ["янв.", "февр.", "мар.", "апр.", "мая", "июня", "июля", "авг.", "сент.", "окт.", "нояб.", "дек."];
    const parts = value => {
        const [year, month, day] = value.split("-").map(Number);
        return {year: year, label: day + " " + months[month - 1]};
    };
    const start = parts(days[0].date);
    const end = parts(days[days.length - 1].date);
    if (start.year !== end.year) return start.label + " " + start.year + " — " + end.label + " " + end.year;
    return start.label + " — " + end.label + " " + end.year;
}

function calendar(data) {
    const counts = {};
    for (const item of data?.heatmap || []) counts[item.date] = item.count;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(today.getDate() - (today.getDay() + 6) % 7 - 25 * 7);
    const cells = [];
    for (let i = 0; i < 182; i++) {
        const date = new Date(start); date.setDate(start.getDate() + i);
        const key = date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
        const count = counts[key] || 0;
        cells.push({date: key, count: count, future: date > today, month: date.getMonth(), level: count === 0 ? 0 : count < 5 ? 1 : count < 15 ? 2 : count < 30 ? 3 : 4});
    }
    return cells;
}
