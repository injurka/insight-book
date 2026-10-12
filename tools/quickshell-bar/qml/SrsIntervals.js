.pragma library
// Generated from ts-fsrs; rebuild with build-intervals.sh.
/*
MIT License

Copyright (c) 2026 Open Spaced Repetition

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
// ../../node_modules/.bun/ts-fsrs@5.4.2/node_modules/ts-fsrs/dist/index.mjs
var FSRSError = /** @class */ (function (_super) {
    __extends(FSRSError, _super);
    function FSRSError(message) {
        if (message === void 0) { message = "FSRS Error"; }
        var _a;
        var _this_1 = _super.call(this, message) || this;
        _this_1.name = "FSRSError";
        (_a = Error.captureStackTrace) === null || _a === void 0 ? void 0 : _a.call(Error, _this_1, FSRSError);
        return _this_1;
    }
    return FSRSError;
}(Error));
var FSRSValidationError = /** @class */ (function (_super) {
    __extends(FSRSValidationError, _super);
    function FSRSValidationError(message) {
        var _a;
        var _this_1 = _super.call(this, message) || this;
        _this_1.name = "FSRSValidationError";
        (_a = Error.captureStackTrace) === null || _a === void 0 ? void 0 : _a.call(Error, _this_1, FSRSValidationError);
        return _this_1;
    }
    return FSRSValidationError;
}(FSRSError));
var State = /* @__PURE__ */ (function (State2) {
    State2[State2["New"] = 0] = "New";
    State2[State2["Learning"] = 1] = "Learning";
    State2[State2["Review"] = 2] = "Review";
    State2[State2["Relearning"] = 3] = "Relearning";
    return State2;
})(State || {});
var Rating = /* @__PURE__ */ (function (Rating2) {
    Rating2[Rating2["Manual"] = 0] = "Manual";
    Rating2[Rating2["Again"] = 1] = "Again";
    Rating2[Rating2["Hard"] = 2] = "Hard";
    Rating2[Rating2["Good"] = 3] = "Good";
    Rating2[Rating2["Easy"] = 4] = "Easy";
    return Rating2;
})(Rating || {});
var TypeConvert = /** @class */ (function () {
    function TypeConvert() {
    }
    TypeConvert.card = function (card) {
        return __assign(__assign({}, card), { state: TypeConvert.state(card.state), due: TypeConvert.time(card.due), last_review: card.last_review ? TypeConvert.time(card.last_review) : undefined });
    };
    TypeConvert.rating = function (value) {
        if (typeof value === "string") {
            var firstLetter = value.charAt(0).toUpperCase();
            var restOfString = value.slice(1).toLowerCase();
            var ret = Rating["".concat(firstLetter).concat(restOfString)];
            if (ret === undefined) {
                throw new FSRSValidationError("Invalid rating:[".concat(value, "]"));
            }
            return ret;
        }
        else if (typeof value === "number") {
            return value;
        }
        throw new FSRSValidationError("Invalid rating:[".concat(value, "]"));
    };
    TypeConvert.state = function (value) {
        if (typeof value === "string") {
            var firstLetter = value.charAt(0).toUpperCase();
            var restOfString = value.slice(1).toLowerCase();
            var ret = State["".concat(firstLetter).concat(restOfString)];
            if (ret === undefined) {
                throw new FSRSValidationError("Invalid state:[".concat(value, "]"));
            }
            return ret;
        }
        else if (typeof value === "number") {
            return value;
        }
        throw new FSRSValidationError("Invalid state:[".concat(value, "]"));
    };
    TypeConvert.time = function (value) {
        if (value instanceof Date) {
            return value;
        }
        var date = new Date(value);
        if (typeof value === "object" && value !== null && !Number.isNaN(Date.parse(value) || +date)) {
            return date;
        }
        else if (typeof value === "string") {
            var timestamp = Date.parse(value);
            if (!Number.isNaN(timestamp)) {
                return new Date(timestamp);
            }
            else {
                throw new FSRSValidationError("Invalid date:[".concat(value, "]"));
            }
        }
        else if (typeof value === "number") {
            return new Date(value);
        }
        throw new FSRSValidationError("Invalid date:[".concat(value, "]"));
    };
    TypeConvert.review_log = function (log) {
        return __assign(__assign({}, log), { due: TypeConvert.time(log.due), rating: TypeConvert.rating(log.rating), state: TypeConvert.state(log.state), review: TypeConvert.time(log.review) });
    };
    return TypeConvert;
}());
Date.prototype.scheduler = function (t, isDay) {
    return date_scheduler(this, t, isDay);
};
Date.prototype.diff = function (pre, unit) {
    return date_diff(this, pre, unit);
};
Date.prototype.format = function () {
    return formatDate(this);
};
Date.prototype.dueFormat = function (last_review, unit, timeUnit) {
    return show_diff_message(this, last_review, unit, timeUnit);
};
function date_scheduler(now, t, isDay) {
    return new Date(isDay ? TypeConvert.time(now).getTime() + t * 24 * 60 * 60 * 1000 : TypeConvert.time(now).getTime() + t * 60 * 1000);
}
function date_diff(now, pre, unit) {
    if (!now || !pre) {
        throw new FSRSValidationError("Invalid date");
    }
    var diff = TypeConvert.time(now).getTime() - TypeConvert.time(pre).getTime();
    var r = 0;
    switch (unit) {
        case "days":
            r = Math.floor(diff / (24 * 60 * 60 * 1000));
            break;
        case "minutes":
            r = Math.floor(diff / (60 * 1000));
            break;
    }
    return r;
}
function formatDate(dateInput) {
    var date = TypeConvert.time(dateInput);
    var year = date.getFullYear();
    var month = date.getMonth() + 1;
    var day = date.getDate();
    var hours = date.getHours();
    var minutes = date.getMinutes();
    var seconds = date.getSeconds();
    return "".concat(year, "-").concat(padZero(month), "-").concat(padZero(day), " ").concat(padZero(hours), ":").concat(padZero(minutes), ":").concat(padZero(seconds));
}
function padZero(num) {
    return num < 10 ? "0".concat(num) : "".concat(num);
}
var TIMEUNIT = [60, 60, 24, 31, 12];
var TIMEUNITFORMAT = ["second", "min", "hour", "day", "month", "year"];
function show_diff_message(due, last_review, unit, timeUnit) {
    if (timeUnit === void 0) { timeUnit = TIMEUNITFORMAT; }
    due = TypeConvert.time(due);
    last_review = TypeConvert.time(last_review);
    if (timeUnit.length !== TIMEUNITFORMAT.length) {
        timeUnit = TIMEUNITFORMAT;
    }
    var diff = due.getTime() - last_review.getTime();
    var i = 0;
    diff /= 1000;
    for (i = 0; i < TIMEUNIT.length; i++) {
        if (diff < TIMEUNIT[i]) {
            break;
        }
        else {
            diff /= TIMEUNIT[i];
        }
    }
    return "".concat(Math.floor(diff)).concat(unit ? timeUnit[i] : "");
}
var Grades = Object.freeze([
    Rating.Again,
    Rating.Hard,
    Rating.Good,
    Rating.Easy
]);
var FUZZ_RANGES = [
    {
        start: 2.5,
        end: 7,
        factor: 0.15
    },
    {
        start: 7,
        end: 20,
        factor: 0.1
    },
    {
        start: 20,
        end: Infinity,
        factor: 0.05
    }
];
function get_fuzz_range(interval, elapsed_days, maximum_interval) {
    var e_1, _a;
    var delta = 1;
    try {
        for (var FUZZ_RANGES_1 = __values(FUZZ_RANGES), FUZZ_RANGES_1_1 = FUZZ_RANGES_1.next(); !FUZZ_RANGES_1_1.done; FUZZ_RANGES_1_1 = FUZZ_RANGES_1.next()) {
            var range = FUZZ_RANGES_1_1.value;
            delta += range.factor * Math.max(Math.min(interval, range.end) - range.start, 0);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (FUZZ_RANGES_1_1 && !FUZZ_RANGES_1_1.done && (_a = FUZZ_RANGES_1.return)) _a.call(FUZZ_RANGES_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    interval = Math.min(interval, maximum_interval);
    var min_ivl = Math.max(2, Math.round(interval - delta));
    var max_ivl = Math.min(Math.round(interval + delta), maximum_interval);
    if (interval > elapsed_days) {
        min_ivl = Math.max(min_ivl, elapsed_days + 1);
    }
    min_ivl = Math.min(min_ivl, max_ivl);
    return { min_ivl: min_ivl, max_ivl: max_ivl };
}
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
function roundTo(num, decimals) {
    var factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
}
function dateDiffInDays(last, cur) {
    var utc1 = Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate());
    var utc2 = Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate());
    return Math.floor((utc2 - utc1) / 86400000);
}
var ConvertStepUnitToMinutes = function (step) {
    var unit = step.slice(-1);
    var value = parseInt(step.slice(0, -1), 10);
    if (Number.isNaN(value) || !Number.isFinite(value) || value < 0) {
        throw new FSRSValidationError("Invalid step value: ".concat(step));
    }
    switch (unit) {
        case "m":
            return value;
        case "h":
            return value * 60;
        case "d":
            return value * 1440;
        default:
            throw new FSRSValidationError("Invalid step unit: ".concat(step, ", expected m/h/d"));
    }
};
var BasicLearningStepsStrategy = function (params, state, cur_step) {
    var learning_steps = state === State.Relearning || state === State.Review ? params.relearning_steps : params.learning_steps;
    var steps_length = learning_steps.length;
    if (steps_length === 0 || cur_step >= steps_length)
        return {};
    var firstStep = learning_steps[0];
    var toMinutes = ConvertStepUnitToMinutes;
    var getAgainInterval = function () {
        return toMinutes(firstStep);
    };
    var getHardInterval = function () {
        if (steps_length === 1)
            return Math.round(toMinutes(firstStep) * 1.5);
        var nextStep = learning_steps[1];
        return Math.round((toMinutes(firstStep) + toMinutes(nextStep)) / 2);
    };
    var getStepInfo = function (index) {
        if (index < 0 || index >= steps_length) {
            return null;
        }
        else {
            return learning_steps[index];
        }
    };
    var getGoodMinutes = function (step) {
        return toMinutes(step);
    };
    var result = {};
    var step_info = getStepInfo(Math.max(0, cur_step));
    if (state === State.Review) {
        result[Rating.Again] = {
            scheduled_minutes: toMinutes(step_info),
            next_step: 0
        };
        return result;
    }
    else {
        result[Rating.Again] = {
            scheduled_minutes: getAgainInterval(),
            next_step: 0
        };
        result[Rating.Hard] = {
            scheduled_minutes: getHardInterval(),
            next_step: cur_step
        };
        var next_info = getStepInfo(cur_step + 1);
        if (next_info) {
            var nextMin = getGoodMinutes(next_info);
            if (nextMin) {
                result[Rating.Good] = {
                    scheduled_minutes: Math.round(nextMin),
                    next_step: cur_step + 1
                };
            }
        }
    }
    return result;
};
function DefaultInitSeedStrategy() {
    var time = this.review_time.getTime();
    var reps = this.current.reps;
    var mul = this.current.difficulty * this.current.stability;
    return "".concat(time, "_").concat(reps, "_").concat(mul);
}
var StrategyMode = /* @__PURE__ */ (function (StrategyMode2) {
    StrategyMode2["SCHEDULER"] = "Scheduler";
    StrategyMode2["LEARNING_STEPS"] = "LearningSteps";
    StrategyMode2["SEED"] = "Seed";
    return StrategyMode2;
})(StrategyMode || {});
var AbstractScheduler = /** @class */ (function () {
    function AbstractScheduler(card, now, algorithm, strategies) {
        this.next = new Map;
        this.elapsed_days = 0;
        this.algorithm = algorithm;
        this.last = TypeConvert.card(card);
        this.current = TypeConvert.card(card);
        this.review_time = TypeConvert.time(now);
        this.strategies = strategies;
        this.init();
    }
    AbstractScheduler.prototype.checkGrade = function (grade) {
        if (!Number.isFinite(grade) || grade < 1 || grade > 4) {
            throw new FSRSValidationError("Invalid grade \"".concat(grade, "\",expected 1-4"));
        }
    };
    AbstractScheduler.prototype.init = function () {
        var _a = this.current, state = _a.state, last_review = _a.last_review;
        var interval = 0;
        if (state !== State.New && last_review) {
            interval = dateDiffInDays(last_review, this.review_time);
        }
        this.current.last_review = this.review_time;
        this.elapsed_days = interval;
        this.current.elapsed_days = interval;
        this.current.reps += 1;
        var seed_strategy = DefaultInitSeedStrategy;
        if (this.strategies) {
            var custom_strategy = this.strategies.get(StrategyMode.SEED);
            if (custom_strategy) {
                seed_strategy = custom_strategy;
            }
        }
        this.algorithm.seed = seed_strategy.call(this);
    };
    AbstractScheduler.prototype.preview = function () {
        var _a;
        return _a = {},
            _a[Rating.Again] = this.review(Rating.Again),
            _a[Rating.Hard] = this.review(Rating.Hard),
            _a[Rating.Good] = this.review(Rating.Good),
            _a[Rating.Easy] = this.review(Rating.Easy),
            _a[Symbol.iterator] = this.previewIterator.bind(this),
            _a;
    };
    AbstractScheduler.prototype.previewIterator = function () {
        var Grades_1, Grades_1_1, grade, e_2_1;
        var e_2, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 5, 6, 7]);
                    Grades_1 = __values(Grades), Grades_1_1 = Grades_1.next();
                    _b.label = 1;
                case 1:
                    if (!!Grades_1_1.done) return [3 /*break*/, 4];
                    grade = Grades_1_1.value;
                    return [4 /*yield*/, this.review(grade)];
                case 2:
                    _b.sent();
                    _b.label = 3;
                case 3:
                    Grades_1_1 = Grades_1.next();
                    return [3 /*break*/, 1];
                case 4: return [3 /*break*/, 7];
                case 5:
                    e_2_1 = _b.sent();
                    e_2 = { error: e_2_1 };
                    return [3 /*break*/, 7];
                case 6:
                    try {
                        if (Grades_1_1 && !Grades_1_1.done && (_a = Grades_1.return)) _a.call(Grades_1);
                    }
                    finally { if (e_2) throw e_2.error; }
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    };
    AbstractScheduler.prototype.review = function (grade) {
        var state = this.last.state;
        var item;
        this.checkGrade(grade);
        switch (state) {
            case State.New:
                item = this.newState(grade);
                break;
            case State.Learning:
            case State.Relearning:
                item = this.learningState(grade);
                break;
            case State.Review:
                item = this.reviewState(grade);
                break;
        }
        return item;
    };
    AbstractScheduler.prototype.buildLog = function (rating) {
        var _a = this.last, last_review = _a.last_review, due = _a.due, elapsed_days = _a.elapsed_days;
        return {
            rating: rating,
            state: this.current.state,
            due: last_review || due,
            stability: this.current.stability,
            difficulty: this.current.difficulty,
            elapsed_days: this.elapsed_days,
            last_elapsed_days: elapsed_days,
            scheduled_days: this.current.scheduled_days,
            learning_steps: this.current.learning_steps,
            review: this.review_time
        };
    };
    return AbstractScheduler;
}());
var Alea = /** @class */ (function () {
    function Alea(seed) {
        var mash = Mash();
        this.c = 1;
        this.s0 = mash(" ");
        this.s1 = mash(" ");
        this.s2 = mash(" ");
        if (seed == null)
            seed = Date.now();
        this.s0 -= mash(seed);
        if (this.s0 < 0)
            this.s0 += 1;
        this.s1 -= mash(seed);
        if (this.s1 < 0)
            this.s1 += 1;
        this.s2 -= mash(seed);
        if (this.s2 < 0)
            this.s2 += 1;
    }
    Alea.prototype.next = function () {
        var t = 2091639 * this.s0 + this.c * 0.00000000023283064365386963;
        this.s0 = this.s1;
        this.s1 = this.s2;
        this.c = t | 0;
        this.s2 = t - this.c;
        return this.s2;
    };
    Object.defineProperty(Alea.prototype, "state", {
        get: function () {
            return {
                c: this.c,
                s0: this.s0,
                s1: this.s1,
                s2: this.s2
            };
        },
        set: function (state) {
            this.c = state.c;
            this.s0 = state.s0;
            this.s1 = state.s1;
            this.s2 = state.s2;
        },
        enumerable: false,
        configurable: true
    });
    return Alea;
}());
function Mash() {
    var n = 4022871197;
    return function mash(data) {
        data = String(data);
        for (var i = 0; i < data.length; i++) {
            n += data.charCodeAt(i);
            var h = 0.02519603282416938 * n;
            n = h >>> 0;
            h -= n;
            h *= n;
            n = h >>> 0;
            h -= n;
            n += h * 4294967296;
        }
        return (n >>> 0) * 0.00000000023283064365386963;
    };
}
function alea(seed) {
    var xg = new Alea(seed);
    var prng = function () { return xg.next(); };
    prng.int32 = function () { return xg.next() * 4294967296 | 0; };
    prng.double = function () { return prng() + (prng() * 2097152 | 0) * 0.00000000000000011102230246251565; };
    prng.state = function () { return xg.state; };
    prng.importState = function (state) {
        xg.state = state;
        return prng;
    };
    return prng;
}
var version = "5.4.2";
var default_request_retention = 0.9;
var default_maximum_interval = 36500;
var default_enable_fuzz = false;
var default_enable_short_term = true;
var default_learning_steps = Object.freeze([
    "1m",
    "10m"
]);
var default_relearning_steps = Object.freeze([
    "10m"
]);
var FSRSVersion = "v".concat(version, " using FSRS-6.0");
var S_MIN = 0.001;
var INIT_S_MAX = 100;
var FSRS5_DEFAULT_DECAY = 0.5;
var FSRS6_DEFAULT_DECAY = 0.1542;
var default_w = Object.freeze([
    0.212,
    1.2931,
    2.3065,
    8.2956,
    6.4133,
    0.8334,
    3.0194,
    0.001,
    1.8722,
    0.1666,
    0.796,
    1.4835,
    0.0614,
    0.2629,
    1.6483,
    0.6014,
    1.8729,
    0.5425,
    0.0912,
    0.0658,
    FSRS6_DEFAULT_DECAY
]);
var W17_W18_Ceiling = 2;
var CLAMP_PARAMETERS = function (w17_w18_ceiling, enable_short_term) {
    if (enable_short_term === void 0) { enable_short_term = default_enable_short_term; }
    return [
        [S_MIN, INIT_S_MAX],
        [S_MIN, INIT_S_MAX],
        [S_MIN, INIT_S_MAX],
        [S_MIN, INIT_S_MAX],
        [1, 10],
        [0.001, 4],
        [0.001, 4],
        [0.001, 0.75],
        [0, 4.5],
        [0, 0.8],
        [0.001, 3.5],
        [0.001, 5],
        [0.001, 0.25],
        [0.001, 0.9],
        [0, 4],
        [0, 1],
        [1, 6],
        [0, w17_w18_ceiling],
        [0, w17_w18_ceiling],
        [
            enable_short_term ? 0.01 : 0,
            0.8
        ],
        [0.1, 0.8]
    ];
};
var clipParameters = function (parameters, numRelearningSteps, enableShortTerm) {
    if (enableShortTerm === void 0) { enableShortTerm = default_enable_short_term; }
    var clip = CLAMP_PARAMETERS(W17_W18_Ceiling, enableShortTerm).slice(0, parameters.length);
    if (Math.max(0, numRelearningSteps) > 1) {
        var w11 = clamp(parameters[11] || 0, clip[11][0], clip[11][1]);
        var w13 = clamp(parameters[13] || 0, clip[13][0], clip[13][1]);
        var w14 = clamp(parameters[14] || 0, clip[14][0], clip[14][1]);
        var value = -(Math.log(w11) + Math.log(Math.pow(2, w13) - 1) + w14 * 0.3) / numRelearningSteps;
        var w17_w18_ceiling = clamp(roundTo(Math.sqrt(Math.max(value, 0)), 8), 0.01, W17_W18_Ceiling);
        if (clip[17])
            clip[17] = [clip[17][0], w17_w18_ceiling];
        if (clip[18])
            clip[18] = [clip[18][0], w17_w18_ceiling];
    }
    return clip.map(function (_a, index) {
        var _b = __read(_a, 2), min = _b[0], max = _b[1];
        return clamp(parameters[index] || 0, min, max);
    });
};
var migrateParameters = function (parameters, numRelearningSteps, enableShortTerm) {
    if (numRelearningSteps === void 0) { numRelearningSteps = 0; }
    if (enableShortTerm === void 0) { enableShortTerm = default_enable_short_term; }
    if (parameters === undefined) {
        return __spreadArray([], __read(default_w), false);
    }
    switch (parameters.length) {
        case 21:
            return clipParameters(Array.from(parameters), numRelearningSteps, enableShortTerm);
        case 19:
            console.debug("[FSRS-6]auto fill w from 19 to 21 length");
            return clipParameters(Array.from(parameters), numRelearningSteps, enableShortTerm).concat([0, FSRS5_DEFAULT_DECAY]);
        case 17: {
            var w = clipParameters(Array.from(parameters), numRelearningSteps, enableShortTerm);
            w[4] = +(w[5] * 2 + w[4]).toFixed(8);
            w[5] = +(Math.log(w[5] * 3 + 1) / 3).toFixed(8);
            w[6] = +(w[6] + 0.5).toFixed(8);
            console.debug("[FSRS-6]auto fill w from 17 to 21 length");
            return w.concat([0, 0, 0, FSRS5_DEFAULT_DECAY]);
        }
        default:
            console.warn("[FSRS]Invalid parameters length, using default parameters");
            return __spreadArray([], __read(default_w), false);
    }
};
var generatorParameters = function (props) {
    var _a, _b;
    var learning_steps = Array.isArray(props === null || props === void 0 ? void 0 : props.learning_steps) ? props.learning_steps : default_learning_steps;
    var relearning_steps = Array.isArray(props === null || props === void 0 ? void 0 : props.relearning_steps) ? props.relearning_steps : default_relearning_steps;
    var enable_short_term = (_a = props === null || props === void 0 ? void 0 : props.enable_short_term) !== null && _a !== void 0 ? _a : default_enable_short_term;
    var w = migrateParameters(props === null || props === void 0 ? void 0 : props.w, relearning_steps.length, enable_short_term);
    return {
        request_retention: (props === null || props === void 0 ? void 0 : props.request_retention) || default_request_retention,
        maximum_interval: (props === null || props === void 0 ? void 0 : props.maximum_interval) || default_maximum_interval,
        w: w,
        enable_fuzz: (_b = props === null || props === void 0 ? void 0 : props.enable_fuzz) !== null && _b !== void 0 ? _b : default_enable_fuzz,
        enable_short_term: enable_short_term,
        learning_steps: learning_steps,
        relearning_steps: relearning_steps
    };
};
function createEmptyCard(now, afterHandler) {
    var emptyCard = {
        due: now ? TypeConvert.time(now) : /* @__PURE__ */ new Date,
        stability: 0,
        difficulty: 0,
        elapsed_days: 0,
        scheduled_days: 0,
        reps: 0,
        lapses: 0,
        learning_steps: 0,
        state: State.New,
        last_review: undefined
    };
    if (afterHandler && typeof afterHandler === "function") {
        return afterHandler(emptyCard);
    }
    else {
        return emptyCard;
    }
}
var computeDecayFactor = function (decayOrParams) {
    var decay = typeof decayOrParams === "number" ? -decayOrParams : -decayOrParams[20];
    var factor = Math.exp(Math.pow(decay, -1) * Math.log(0.9)) - 1;
    return { decay: decay, factor: roundTo(factor, 8) };
};
function forgetting_curve(decayOrParams, elapsed_days, stability) {
    var _a = computeDecayFactor(decayOrParams), decay = _a.decay, factor = _a.factor;
    return roundTo(Math.pow(1 + factor * elapsed_days / stability, decay), 8);
}
var FSRSAlgorithm = /** @class */ (function () {
    function FSRSAlgorithm(params) {
        this.prepare_parameters = function (params) {
            var generated = generatorParameters(params);
            generated.w = clipParameters(Array.from(generated.w), generated.relearning_steps.length, generated.enable_short_term);
            return generated;
        };
        this.param = new Proxy(this.prepare_parameters(params), this.params_handler_proxy());
        this.intervalModifier = this.calculate_interval_modifier(this.param.request_retention);
        this.forgetting_curve = forgetting_curve.bind(this, this.param.w);
    }
    Object.defineProperty(FSRSAlgorithm.prototype, "interval_modifier", {
        get: function () {
            return this.intervalModifier;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(FSRSAlgorithm.prototype, "seed", {
        set: function (seed) {
            this._seed = seed;
        },
        enumerable: false,
        configurable: true
    });
    FSRSAlgorithm.prototype.calculate_interval_modifier = function (request_retention) {
        if (request_retention <= 0 || request_retention > 1) {
            throw new FSRSValidationError("Requested retention rate should be in the range (0,1]");
        }
        var _a = computeDecayFactor(this.param.w), decay = _a.decay, factor = _a.factor;
        return roundTo((Math.pow(request_retention, 1 / decay) - 1) / factor, 8);
    };
    Object.defineProperty(FSRSAlgorithm.prototype, "parameters", {
        get: function () {
            return this.param;
        },
        set: function (params) {
            this.update_parameters(params);
        },
        enumerable: false,
        configurable: true
    });
    FSRSAlgorithm.prototype.params_handler_proxy = function () {
        var _this = this;
        return {
            set: function (target, prop, value) {
                if (prop === "request_retention" && Number.isFinite(value)) {
                    _this.intervalModifier = _this.calculate_interval_modifier(Number(value));
                }
                else if (prop === "w") {
                    value = migrateParameters(value, target.relearning_steps.length, target.enable_short_term);
                    value = clipParameters(Array.from(value), target.relearning_steps.length, target.enable_short_term);
                    _this.forgetting_curve = forgetting_curve.bind(this, value);
                    _this.intervalModifier = _this.calculate_interval_modifier(Number(target.request_retention));
                }
                Reflect.set(target, prop, value);
                return true;
            }
        };
    };
    FSRSAlgorithm.prototype.update_parameters = function (params) {
        var _params = this.prepare_parameters(params);
        for (var key in _params) {
            var paramKey = key;
            this.param[paramKey] = _params[paramKey];
        }
    };
    FSRSAlgorithm.prototype.init_stability = function (g) {
        return Math.max(this.param.w[g - 1], 0.1);
    };
    FSRSAlgorithm.prototype.init_difficulty = function (g) {
        var w = this.param.w;
        var d = w[4] - Math.exp((g - 1) * w[5]) + 1;
        return roundTo(d, 8);
    };
    FSRSAlgorithm.prototype.apply_fuzz = function (ivl, elapsed_days) {
        if (!this.param.enable_fuzz || ivl < 2.5)
            return Math.round(ivl);
        var generator = alea(this._seed);
        var fuzz_factor = generator();
        var _a = get_fuzz_range(ivl, elapsed_days, this.param.maximum_interval), min_ivl = _a.min_ivl, max_ivl = _a.max_ivl;
        return Math.floor(fuzz_factor * (max_ivl - min_ivl + 1) + min_ivl);
    };
    FSRSAlgorithm.prototype.next_interval = function (s, elapsed_days) {
        var newInterval = Math.min(Math.max(1, Math.round(s * this.intervalModifier)), this.param.maximum_interval);
        return this.apply_fuzz(newInterval, elapsed_days);
    };
    FSRSAlgorithm.prototype.linear_damping = function (delta_d, old_d) {
        return roundTo(delta_d * (10 - old_d) / 9, 8);
    };
    FSRSAlgorithm.prototype.next_difficulty = function (d, g) {
        var delta_d = -this.param.w[6] * (g - 3);
        var next_d = d + this.linear_damping(delta_d, d);
        return clamp(this.mean_reversion(this.init_difficulty(Rating.Easy), next_d), 1, 10);
    };
    FSRSAlgorithm.prototype.mean_reversion = function (init, current) {
        var w = this.param.w;
        return roundTo(w[7] * init + (1 - w[7]) * current, 8);
    };
    FSRSAlgorithm.prototype.next_recall_stability = function (d, s, r, g) {
        var w = this.param.w;
        var hard_penalty = Rating.Hard === g ? w[15] : 1;
        var easy_bound = Rating.Easy === g ? w[16] : 1;
        return roundTo(clamp(s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp((1 - r) * w[10]) - 1) * hard_penalty * easy_bound), S_MIN, 36500), 8);
    };
    FSRSAlgorithm.prototype.next_forget_stability = function (d, s, r) {
        var w = this.param.w;
        return roundTo(clamp(w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp((1 - r) * w[14]), S_MIN, 36500), 8);
    };
    FSRSAlgorithm.prototype.next_short_term_stability = function (s, g) {
        var w = this.param.w;
        var sinc = Math.pow(s, -w[19]) * Math.exp(w[17] * (g - 3 + w[18]));
        var maskedSinc = g >= Rating.Hard ? Math.max(sinc, 1) : sinc;
        return roundTo(clamp(s * maskedSinc, S_MIN, 36500), 8);
    };
    FSRSAlgorithm.prototype.next_state = function (memory_state, t, g, r) {
        var _a = memory_state !== null && memory_state !== void 0 ? memory_state : {
            difficulty: 0,
            stability: 0
        }, d = _a.difficulty, s = _a.stability;
        if (t < 0) {
            throw new FSRSValidationError("Invalid delta_t \"".concat(t, "\""));
        }
        if (g < 0 || g > 4) {
            throw new FSRSValidationError("Invalid grade \"".concat(g, "\""));
        }
        if (d === 0 && s === 0) {
            return {
                difficulty: clamp(this.init_difficulty(g), 1, 10),
                stability: this.init_stability(g)
            };
        }
        if (g === 0) {
            return {
                difficulty: d,
                stability: s
            };
        }
        if (d < 1 || s < S_MIN) {
            throw new FSRSValidationError("Invalid memory state { difficulty: ".concat(d, ", stability: ").concat(s, " }"));
        }
        var w = this.param.w;
        r = typeof r === "number" ? r : this.forgetting_curve(t, s);
        var new_s;
        if (t === 0 && this.param.enable_short_term) {
            new_s = this.next_short_term_stability(s, g);
        }
        else if (g === 1) {
            var s_after_fail = this.next_forget_stability(d, s, r);
            var _b = __read([0, 0], 2), w_17 = _b[0], w_18 = _b[1];
            if (this.param.enable_short_term) {
                w_17 = w[17];
                w_18 = w[18];
            }
            var next_s_min = s / Math.exp(w_17 * w_18);
            new_s = clamp(roundTo(next_s_min, 8), S_MIN, s_after_fail);
        }
        else {
            new_s = this.next_recall_stability(d, s, r, g);
        }
        var new_d = this.next_difficulty(d, g);
        return { difficulty: new_d, stability: new_s };
    };
    return FSRSAlgorithm;
}());
var BasicScheduler = /** @class */ (function (_super) {
    __extends(BasicScheduler, _super);
    function BasicScheduler(card, now, algorithm, strategies) {
        var _this_1 = _super.call(this, card, now, algorithm, strategies) || this;
        var learningStepStrategy = BasicLearningStepsStrategy;
        if (_this_1.strategies) {
            var custom_strategy = _this_1.strategies.get(StrategyMode.LEARNING_STEPS);
            if (custom_strategy) {
                learningStepStrategy = custom_strategy;
            }
        }
        _this_1.learningStepsStrategy = learningStepStrategy;
        return _this_1;
    }
    BasicScheduler.prototype.getLearningInfo = function (card, grade) {
        var _a, _b, _c, _d;
        var parameters = this.algorithm.parameters;
        card.learning_steps = card.learning_steps || 0;
        var steps_strategy = this.learningStepsStrategy(parameters, card.state, card.learning_steps);
        var scheduled_minutes = Math.max(0, (_b = (_a = steps_strategy[grade]) === null || _a === void 0 ? void 0 : _a.scheduled_minutes) !== null && _b !== void 0 ? _b : 0);
        var next_steps = Math.max(0, (_d = (_c = steps_strategy[grade]) === null || _c === void 0 ? void 0 : _c.next_step) !== null && _d !== void 0 ? _d : 0);
        return {
            scheduled_minutes: scheduled_minutes,
            next_steps: next_steps
        };
    };
    BasicScheduler.prototype.applyLearningSteps = function (nextCard, grade, to_state) {
        var _a = this.getLearningInfo(this.current, grade), scheduled_minutes = _a.scheduled_minutes, next_steps = _a.next_steps;
        if (scheduled_minutes > 0 && scheduled_minutes < 1440) {
            nextCard.learning_steps = next_steps;
            nextCard.scheduled_days = 0;
            nextCard.state = to_state;
            nextCard.due = date_scheduler(this.review_time, Math.round(scheduled_minutes), false);
        }
        else {
            nextCard.state = State.Review;
            if (scheduled_minutes >= 1440) {
                nextCard.learning_steps = next_steps;
                nextCard.due = date_scheduler(this.review_time, Math.round(scheduled_minutes), false);
                nextCard.scheduled_days = Math.floor(scheduled_minutes / 1440);
            }
            else {
                nextCard.learning_steps = 0;
                var interval = this.algorithm.next_interval(nextCard.stability, this.elapsed_days);
                nextCard.scheduled_days = interval;
                nextCard.due = date_scheduler(this.review_time, interval, true);
            }
        }
    };
    BasicScheduler.prototype.newState = function (grade) {
        var exist = this.next.get(grade);
        if (exist) {
            return exist;
        }
        var next = this.next_ds(this.elapsed_days, grade);
        this.applyLearningSteps(next, grade, State.Learning);
        var item = {
            card: next,
            log: this.buildLog(grade)
        };
        this.next.set(grade, item);
        return item;
    };
    BasicScheduler.prototype.learningState = function (grade) {
        var exist = this.next.get(grade);
        if (exist) {
            return exist;
        }
        var next = this.next_ds(this.elapsed_days, grade);
        this.applyLearningSteps(next, grade, this.last.state);
        var item = {
            card: next,
            log: this.buildLog(grade)
        };
        this.next.set(grade, item);
        return item;
    };
    BasicScheduler.prototype.reviewState = function (grade) {
        var exist = this.next.get(grade);
        if (exist) {
            return exist;
        }
        var interval = this.elapsed_days;
        var retrievability = this.algorithm.forgetting_curve(interval, this.current.stability);
        var next_again = this.next_ds(interval, Rating.Again, retrievability);
        var next_hard = this.next_ds(interval, Rating.Hard, retrievability);
        var next_good = this.next_ds(interval, Rating.Good, retrievability);
        var next_easy = this.next_ds(interval, Rating.Easy, retrievability);
        this.next_interval(next_hard, next_good, next_easy, interval);
        this.next_state(next_hard, next_good, next_easy);
        this.applyLearningSteps(next_again, Rating.Again, State.Relearning);
        next_again.lapses += 1;
        var item_again = {
            card: next_again,
            log: this.buildLog(Rating.Again)
        };
        var item_hard = {
            card: next_hard,
            log: _super.prototype.buildLog.call(this, Rating.Hard)
        };
        var item_good = {
            card: next_good,
            log: _super.prototype.buildLog.call(this, Rating.Good)
        };
        var item_easy = {
            card: next_easy,
            log: _super.prototype.buildLog.call(this, Rating.Easy)
        };
        this.next.set(Rating.Again, item_again);
        this.next.set(Rating.Hard, item_hard);
        this.next.set(Rating.Good, item_good);
        this.next.set(Rating.Easy, item_easy);
        return this.next.get(grade);
    };
    BasicScheduler.prototype.next_ds = function (t, g, r) {
        var next_state = this.algorithm.next_state({
            difficulty: this.current.difficulty,
            stability: this.current.stability
        }, t, g, r);
        var card = TypeConvert.card(this.current);
        card.difficulty = next_state.difficulty;
        card.stability = next_state.stability;
        return card;
    };
    BasicScheduler.prototype.next_interval = function (next_hard, next_good, next_easy, interval) {
        var hard_interval, good_interval;
        hard_interval = this.algorithm.next_interval(next_hard.stability, interval);
        good_interval = this.algorithm.next_interval(next_good.stability, interval);
        hard_interval = Math.min(hard_interval, good_interval);
        good_interval = Math.max(good_interval, hard_interval + 1);
        var easy_interval = Math.max(this.algorithm.next_interval(next_easy.stability, interval), good_interval + 1);
        next_hard.scheduled_days = hard_interval;
        next_hard.due = date_scheduler(this.review_time, hard_interval, true);
        next_good.scheduled_days = good_interval;
        next_good.due = date_scheduler(this.review_time, good_interval, true);
        next_easy.scheduled_days = easy_interval;
        next_easy.due = date_scheduler(this.review_time, easy_interval, true);
    };
    BasicScheduler.prototype.next_state = function (next_hard, next_good, next_easy) {
        next_hard.state = State.Review;
        next_hard.learning_steps = 0;
        next_good.state = State.Review;
        next_good.learning_steps = 0;
        next_easy.state = State.Review;
        next_easy.learning_steps = 0;
    };
    return BasicScheduler;
}(AbstractScheduler));
var LongTermScheduler = /** @class */ (function (_super) {
    __extends(LongTermScheduler, _super);
    function LongTermScheduler() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    LongTermScheduler.prototype.newState = function (grade) {
        var exist = this.next.get(grade);
        if (exist) {
            return exist;
        }
        this.current.scheduled_days = 0;
        this.current.elapsed_days = 0;
        var first_interval = 0;
        var next_again = this.next_ds(first_interval, Rating.Again);
        var next_hard = this.next_ds(first_interval, Rating.Hard);
        var next_good = this.next_ds(first_interval, Rating.Good);
        var next_easy = this.next_ds(first_interval, Rating.Easy);
        this.next_interval(next_again, next_hard, next_good, next_easy, first_interval);
        this.next_state(next_again, next_hard, next_good, next_easy);
        this.update_next(next_again, next_hard, next_good, next_easy);
        return this.next.get(grade);
    };
    LongTermScheduler.prototype.next_ds = function (t, g, r) {
        var next_state = this.algorithm.next_state({
            difficulty: this.current.difficulty,
            stability: this.current.stability
        }, t, g, r);
        var card = TypeConvert.card(this.current);
        card.difficulty = next_state.difficulty;
        card.stability = next_state.stability;
        return card;
    };
    LongTermScheduler.prototype.learningState = function (grade) {
        return this.reviewState(grade);
    };
    LongTermScheduler.prototype.reviewState = function (grade) {
        var exist = this.next.get(grade);
        if (exist) {
            return exist;
        }
        var interval = this.elapsed_days;
        var retrievability = this.algorithm.forgetting_curve(interval, this.current.stability);
        var next_again = this.next_ds(interval, Rating.Again, retrievability);
        var next_hard = this.next_ds(interval, Rating.Hard, retrievability);
        var next_good = this.next_ds(interval, Rating.Good, retrievability);
        var next_easy = this.next_ds(interval, Rating.Easy, retrievability);
        this.next_interval(next_again, next_hard, next_good, next_easy, interval);
        this.next_state(next_again, next_hard, next_good, next_easy);
        next_again.lapses += 1;
        this.update_next(next_again, next_hard, next_good, next_easy);
        return this.next.get(grade);
    };
    LongTermScheduler.prototype.next_interval = function (next_again, next_hard, next_good, next_easy, interval) {
        var again_interval, hard_interval, good_interval, easy_interval;
        again_interval = this.algorithm.next_interval(next_again.stability, interval);
        hard_interval = this.algorithm.next_interval(next_hard.stability, interval);
        good_interval = this.algorithm.next_interval(next_good.stability, interval);
        easy_interval = this.algorithm.next_interval(next_easy.stability, interval);
        again_interval = Math.min(again_interval, hard_interval);
        hard_interval = Math.max(hard_interval, again_interval + 1);
        good_interval = Math.max(good_interval, hard_interval + 1);
        easy_interval = Math.max(easy_interval, good_interval + 1);
        next_again.scheduled_days = again_interval;
        next_again.due = date_scheduler(this.review_time, again_interval, true);
        next_hard.scheduled_days = hard_interval;
        next_hard.due = date_scheduler(this.review_time, hard_interval, true);
        next_good.scheduled_days = good_interval;
        next_good.due = date_scheduler(this.review_time, good_interval, true);
        next_easy.scheduled_days = easy_interval;
        next_easy.due = date_scheduler(this.review_time, easy_interval, true);
    };
    LongTermScheduler.prototype.next_state = function (next_again, next_hard, next_good, next_easy) {
        next_again.state = State.Review;
        next_again.learning_steps = 0;
        next_hard.state = State.Review;
        next_hard.learning_steps = 0;
        next_good.state = State.Review;
        next_good.learning_steps = 0;
        next_easy.state = State.Review;
        next_easy.learning_steps = 0;
    };
    LongTermScheduler.prototype.update_next = function (next_again, next_hard, next_good, next_easy) {
        var item_again = {
            card: next_again,
            log: this.buildLog(Rating.Again)
        };
        var item_hard = {
            card: next_hard,
            log: _super.prototype.buildLog.call(this, Rating.Hard)
        };
        var item_good = {
            card: next_good,
            log: _super.prototype.buildLog.call(this, Rating.Good)
        };
        var item_easy = {
            card: next_easy,
            log: _super.prototype.buildLog.call(this, Rating.Easy)
        };
        this.next.set(Rating.Again, item_again);
        this.next.set(Rating.Hard, item_hard);
        this.next.set(Rating.Good, item_good);
        this.next.set(Rating.Easy, item_easy);
    };
    return LongTermScheduler;
}(AbstractScheduler));
var Reschedule = /** @class */ (function () {
    function Reschedule(fsrs) {
        this.fsrs = fsrs;
    }
    Reschedule.prototype.replay = function (card, reviewed, rating) {
        return this.fsrs.next(card, reviewed, rating);
    };
    Reschedule.prototype.handleManualRating = function (card, state, reviewed, elapsed_days, stability, difficulty, due) {
        if (typeof state === "undefined") {
            throw new FSRSValidationError("reschedule: state is required for manual rating");
        }
        var log;
        var next_card;
        if (state === State.New) {
            log = {
                rating: Rating.Manual,
                state: state,
                due: due !== null && due !== void 0 ? due : reviewed,
                stability: card.stability,
                difficulty: card.difficulty,
                elapsed_days: elapsed_days,
                last_elapsed_days: card.elapsed_days,
                scheduled_days: card.scheduled_days,
                learning_steps: card.learning_steps,
                review: reviewed
            };
            next_card = createEmptyCard(reviewed);
            next_card.last_review = reviewed;
        }
        else {
            if (typeof due === "undefined") {
                throw new FSRSValidationError("reschedule: due is required for manual rating");
            }
            var scheduled_days = date_diff(due, reviewed, "days");
            log = {
                rating: Rating.Manual,
                state: card.state,
                due: card.last_review || card.due,
                stability: card.stability,
                difficulty: card.difficulty,
                elapsed_days: elapsed_days,
                last_elapsed_days: card.elapsed_days,
                scheduled_days: card.scheduled_days,
                learning_steps: card.learning_steps,
                review: reviewed
            };
            next_card = __assign(__assign({}, card), { state: state, due: due, last_review: reviewed, stability: stability || card.stability, difficulty: difficulty || card.difficulty, elapsed_days: elapsed_days, scheduled_days: scheduled_days, reps: card.reps + 1 });
        }
        return { card: next_card, log: log };
    };
    Reschedule.prototype.reschedule = function (current_card, reviews) {
        var e_3, _a;
        var collections = [];
        var cur_card = createEmptyCard(current_card.due);
        try {
            for (var reviews_1 = __values(reviews), reviews_1_1 = reviews_1.next(); !reviews_1_1.done; reviews_1_1 = reviews_1.next()) {
                var review = reviews_1_1.value;
                var item = void 0;
                review.review = TypeConvert.time(review.review);
                if (review.rating === Rating.Manual) {
                    var interval = 0;
                    if (cur_card.state !== State.New && cur_card.last_review) {
                        interval = date_diff(review.review, cur_card.last_review, "days");
                    }
                    item = this.handleManualRating(cur_card, review.state, review.review, interval, review.stability, review.difficulty, review.due ? TypeConvert.time(review.due) : undefined);
                }
                else {
                    item = this.replay(cur_card, review.review, review.rating);
                }
                collections.push(item);
                cur_card = item.card;
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (reviews_1_1 && !reviews_1_1.done && (_a = reviews_1.return)) _a.call(reviews_1);
            }
            finally { if (e_3) throw e_3.error; }
        }
        return collections;
    };
    Reschedule.prototype.calculateManualRecord = function (current_card, now, record_log_item, update_memory) {
        if (!record_log_item) {
            return null;
        }
        var reschedule_card = record_log_item.card, log = record_log_item.log;
        var cur_card = TypeConvert.card(current_card);
        if (cur_card.due.getTime() === reschedule_card.due.getTime()) {
            return null;
        }
        cur_card.scheduled_days = date_diff(reschedule_card.due, cur_card.due, "days");
        return this.handleManualRating(cur_card, reschedule_card.state, TypeConvert.time(now), log.elapsed_days, update_memory ? reschedule_card.stability : undefined, update_memory ? reschedule_card.difficulty : undefined, reschedule_card.due);
    };
    return Reschedule;
}());
function applyAfterHandler(value, afterHandler) {
    return typeof afterHandler === "function" ? afterHandler(value) : value;
}
var FSRS = /** @class */ (function (_super) {
    __extends(FSRS, _super);
    function FSRS(param) {
        var _this_1 = _super.call(this, param) || this;
        _this_1.strategyHandler = new Map;
        var enable_short_term = _this_1.parameters.enable_short_term;
        _this_1.Scheduler = enable_short_term ? BasicScheduler : LongTermScheduler;
        return _this_1;
    }
    FSRS.prototype.params_handler_proxy = function () {
        var _this = this;
        return {
            set: function (target, prop, value) {
                if (prop === "request_retention" && Number.isFinite(value)) {
                    _this.intervalModifier = _this.calculate_interval_modifier(Number(value));
                }
                else if (prop === "enable_short_term") {
                    _this.Scheduler = value === true ? BasicScheduler : LongTermScheduler;
                }
                else if (prop === "w") {
                    value = migrateParameters(value, target.relearning_steps.length, target.enable_short_term);
                    value = clipParameters(Array.from(value), target.relearning_steps.length, target.enable_short_term);
                    _this.forgetting_curve = forgetting_curve.bind(this, value);
                    _this.intervalModifier = _this.calculate_interval_modifier(Number(target.request_retention));
                }
                Reflect.set(target, prop, value);
                return true;
            }
        };
    };
    FSRS.prototype.useStrategy = function (mode, handler) {
        this.strategyHandler.set(mode, handler);
        return this;
    };
    FSRS.prototype.clearStrategy = function (mode) {
        if (mode) {
            this.strategyHandler.delete(mode);
        }
        else {
            this.strategyHandler.clear();
        }
        return this;
    };
    FSRS.prototype.getScheduler = function (card, now) {
        var schedulerStrategy = this.strategyHandler.get(StrategyMode.SCHEDULER);
        var Scheduler = schedulerStrategy || this.Scheduler;
        var instance = new Scheduler(card, now, this, this.strategyHandler);
        return instance;
    };
    FSRS.prototype.repeat = function (card, now, afterHandler) {
        var instance = this.getScheduler(card, now);
        var recordLog = instance.preview();
        return applyAfterHandler(recordLog, afterHandler);
    };
    FSRS.prototype.next = function (card, now, grade, afterHandler) {
        var instance = this.getScheduler(card, now);
        var g = TypeConvert.rating(grade);
        if (g === Rating.Manual) {
            throw new FSRSValidationError("Cannot review a manual rating");
        }
        var recordLogItem = instance.review(g);
        return applyAfterHandler(recordLogItem, afterHandler);
    };
    FSRS.prototype.get_retrievability = function (card, now, format) {
        if (format === void 0) { format = true; }
        var processedCard = TypeConvert.card(card);
        now = now ? TypeConvert.time(now) : /* @__PURE__ */ new Date;
        var t = processedCard.state !== State.New ? Math.max(date_diff(now, processedCard.last_review, "days"), 0) : 0;
        var r = processedCard.state !== State.New ? this.forgetting_curve(t, +processedCard.stability.toFixed(8)) : 0;
        return format ? "".concat((r * 100).toFixed(2), "%") : r;
    };
    FSRS.prototype.rollback = function (card, log, afterHandler) {
        var processedCard = TypeConvert.card(card);
        var processedLog = TypeConvert.review_log(log);
        if (processedLog.rating === Rating.Manual) {
            throw new FSRSValidationError("Cannot rollback a manual rating");
        }
        var last_due;
        var last_review;
        var last_lapses;
        switch (processedLog.state) {
            case State.New:
                last_due = processedLog.due;
                last_review = undefined;
                last_lapses = 0;
                break;
            case State.Learning:
            case State.Relearning:
            case State.Review:
                last_due = processedLog.review;
                last_review = processedLog.due;
                last_lapses = processedCard.lapses - (processedLog.rating === Rating.Again && processedLog.state === State.Review ? 1 : 0);
                break;
        }
        var prevCard = __assign(__assign({}, processedCard), { due: last_due, stability: processedLog.stability, difficulty: processedLog.difficulty, elapsed_days: processedLog.last_elapsed_days, scheduled_days: processedLog.scheduled_days, reps: Math.max(0, processedCard.reps - 1), lapses: Math.max(0, last_lapses), learning_steps: processedLog.learning_steps, state: processedLog.state, last_review: last_review });
        return applyAfterHandler(prevCard, afterHandler);
    };
    FSRS.prototype.forget = function (card, now, reset_count, afterHandler) {
        if (reset_count === void 0) { reset_count = false; }
        var processedCard = TypeConvert.card(card);
        now = TypeConvert.time(now);
        var scheduled_days = processedCard.state === State.New ? 0 : date_diff(now, processedCard.due, "days");
        var forget_log = {
            rating: Rating.Manual,
            state: processedCard.state,
            due: processedCard.due,
            stability: processedCard.stability,
            difficulty: processedCard.difficulty,
            elapsed_days: 0,
            last_elapsed_days: processedCard.elapsed_days,
            scheduled_days: scheduled_days,
            learning_steps: processedCard.learning_steps,
            review: now
        };
        var forget_card = __assign(__assign({}, processedCard), { due: now, stability: 0, difficulty: 0, elapsed_days: 0, scheduled_days: 0, reps: reset_count ? 0 : processedCard.reps, lapses: reset_count ? 0 : processedCard.lapses, learning_steps: 0, state: State.New, last_review: processedCard.last_review });
        var recordLogItem = { card: forget_card, log: forget_log };
        return applyAfterHandler(recordLogItem, afterHandler);
    };
    FSRS.prototype.reschedule = function (current_card, reviews, options) {
        if (reviews === void 0) { reviews = []; }
        if (options === void 0) { options = {}; }
        var recordLogHandler = options.recordLogHandler, reviewsOrderBy = options.reviewsOrderBy, _a = options.skipManual, skipManual = _a === void 0 ? true : _a, _b = options.now, now = _b === void 0 ? new Date : _b, _c = options.update_memory_state, updateMemoryState = _c === void 0 ? false : _c;
        if (reviewsOrderBy && typeof reviewsOrderBy === "function") {
            reviews.sort(reviewsOrderBy);
        }
        if (skipManual) {
            reviews = reviews.filter(function (review) { return review.rating !== Rating.Manual; });
        }
        var rescheduleSvc = new Reschedule(this);
        var collections = rescheduleSvc.reschedule(options.first_card || createEmptyCard(), reviews);
        var len = collections.length;
        var cur_card = TypeConvert.card(current_card);
        var manual_item = rescheduleSvc.calculateManualRecord(cur_card, now, len ? collections[len - 1] : undefined, updateMemoryState);
        return {
            collections: typeof recordLogHandler === "function" ? collections.map(recordLogHandler) : collections,
            reschedule_item: manual_item ? applyAfterHandler(manual_item, recordLogHandler) : null
        };
    };
    return FSRS;
}(FSRSAlgorithm));
// intervals-entry.js
var scheduler = new FSRS({});
function intervals(data, now) {
    var _a;
    if (now === void 0) { now = new Date; }
    var card = Object.assign(createEmptyCard(now), { due: new Date(data.due), stability: data.stability, difficulty: data.difficultyFsrs, scheduled_days: data.scheduledDays, reps: data.reps, lapses: data.lapses, state: data.state, last_review: data.lastReview ? new Date(data.lastReview) : undefined, learning_steps: (_a = data.learningSteps) !== null && _a !== void 0 ? _a : 0 });
    var results = scheduler.repeat(card, now);
    return [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy].map(function (rating) {
        var next = results[rating].card, days = next.scheduled_days;
        if (days === 0) {
            var minutes = Math.round((next.due.getTime() - now.getTime()) / 60000);
            return minutes > 0 ? minutes + " м" : "<1 м";
        }
        return days < 30 ? Math.round(days) + " дн" : days < 365 ? Math.round(days / 30) + " мес" : Math.round(days / 365) + " г";
    });
}
