export interface TenseDefinition {
  id: string
  name: string
  short: string
  formula: string
  auxiliary: string
  negative: string
  question: string
  uses: readonly string[]
  signals: readonly string[]
  example: string
  translation: string
  commonMistake: string
  matchers: readonly RegExp[]
}

export const tenses: readonly TenseDefinition[] = [
  {
    id: 'present-simple',
    name: 'Present Simple',
    short: 'Факты, привычки, состояния и расписания.',
    formula: 'I/you/we/they + V; he/she/it + V-s',
    auxiliary: 'do / does',
    negative: 'do/does not + V',
    question: 'Do/Does + subject + V?',
    uses: ['регулярное действие или привычка', 'общеизвестный факт и состояние', 'расписание, программа, время отправления'],
    signals: ['always', 'usually', 'often', 'sometimes', 'never', 'rarely', 'every day'],
    example: 'She works from home every Friday.',
    translation: 'Она работает из дома каждую пятницу.',
    commonMistake: 'После does/doesn’t у смыслового глагола не должно быть окончания -s: Does he work?',
    matchers: [
      /\b(?:present\s+simple|simple\s+present)\b/iu,
    ],
  },
  {
    id: 'present-continuous',
    name: 'Present Continuous',
    short: 'Действие происходит сейчас или временно длится.',
    formula: 'am/is/are + V-ing',
    auxiliary: 'am / is / are',
    negative: 'am/is/are not + V-ing',
    question: 'Am/Is/Are + subject + V-ing?',
    uses: ['действие в момент речи или в текущем периоде', 'временная ситуация вокруг настоящего', 'договорённость о будущем с известными временем и местом', 'раздражающая привычка с always'],
    signals: ['now', 'at the moment', 'today', 'this week', 'all the time', 'constantly', 'always'],
    example: 'I am meeting Tom tonight.',
    translation: 'Я встречаюсь с Томом сегодня вечером.',
    commonMistake: 'Не забывайте глагол be: I am reading, а не I reading.',
    matchers: [
      /\b(?:present\s+(?:continuous|progressive)|continuous\s+present)\b/iu,
    ],
  },
  {
    id: 'present-perfect',
    name: 'Present Perfect',
    short: 'Прошлое связано с настоящим: результат, опыт или период до сих пор.',
    formula: 'have/has + V3',
    auxiliary: 'have / has',
    negative: 'have/has not + V3',
    question: 'Have/Has + subject + V3?',
    uses: ['результат важен сейчас', 'опыт без указания точного момента', 'действие в незавершённый период'],
    signals: ['already', 'just', 'yet', 'ever', 'never', 'since', 'for', 'this week'],
    example: 'They have already finished the report.',
    translation: 'Они уже закончили отчёт.',
    commonMistake: 'С точным законченным временем нужен Past Simple: I saw him yesterday, не I have seen him yesterday. Следите за V3 и окончанием -ed у правильных глаголов.',
    matchers: [
      /\b(?:present\s+perfect)(?!\s+(?:continuous|progressive))\b/iu,
    ],
  },
  {
    id: 'present-perfect-continuous',
    name: 'Present Perfect Continuous',
    short: 'Действие началось раньше и длится до сих пор или только что закончилось.',
    formula: 'have/has been + V-ing',
    auxiliary: 'have / has been',
    negative: 'have/has not been + V-ing',
    question: 'Have/Has + subject + been + V-ing?',
    uses: ['важна длительность процесса', 'виден недавний результат процесса', 'действие началось в прошлом и продолжается'],
    signals: ['for a week', 'since morning', 'lately', 'recently', 'all my life', 'how long'],
    example: 'She has been learning English for two years.',
    translation: 'Она учит английский уже два года.',
    commonMistake: 'С глаголами состояния (know, believe, own) обычно выбирают Present Perfect, а не Continuous.',
    matchers: [
      /\b(?:present\s+perfect\s+(?:continuous|progressive)|perfect\s+continuous\s+present)\b/iu,
    ],
  },
  {
    id: 'past-simple',
    name: 'Simple Past',
    short: 'Законченное действие в прошлом, часто с известным моментом.',
    formula: 'subject + V2 / regular V-ed',
    auxiliary: 'did',
    negative: 'did not + V',
    question: 'Did + subject + V?',
    uses: ['однократное завершённое действие', 'цепочка событий в прошлом', 'прошлая привычка или факт'],
    signals: ['yesterday', 'last week', 'ago', 'in 2020', 'the day before yesterday'],
    example: 'He made no answer yesterday.',
    translation: 'Вчера он ничего не ответил.',
    commonMistake: 'После did/didn’t используйте начальную форму: Did she go?, не Did she went? В утверждении — V2 или -ed.',
    matchers: [
      /\b(?:simple\s+past|past\s+simple|past\s+tense)\b/iu,
    ],
  },
  {
    id: 'past-continuous',
    name: 'Past Continuous',
    short: 'Процесс был в разгаре в определённый момент прошлого.',
    formula: 'was/were + V-ing',
    auxiliary: 'was / were',
    negative: 'was/were not + V-ing',
    question: 'Was/Were + subject + V-ing?',
    uses: ['процесс в конкретный момент прошлого', 'длительное действие, прерванное событием', 'два параллельных процесса или фон'],
    signals: ['at 5 yesterday', 'while', 'when', 'all day long', 'the whole day', 'from 7 till 11'],
    example: 'I was reading when you called.',
    translation: 'Я читал, когда ты позвонил.',
    commonMistake: 'Короткое прерывающее событие обычно ставится в Past Simple: was reading when called.',
    matchers: [
      /\b(?:past\s+(?:continuous|progressive)|continuous\s+past)\b/iu,
    ],
  },
  {
    id: 'past-perfect',
    name: 'Past Perfect',
    short: 'Одно действие произошло раньше другого момента в прошлом.',
    formula: 'had + V3',
    auxiliary: 'had',
    negative: 'had not + V3',
    question: 'Had + subject + V3?',
    uses: ['«прошлое до прошлого»', 'объяснение причины или уже полученного результата в прошлом', 'порядок событий нужно подчеркнуть'],
    signals: ['before', 'after', 'by the time', 'by that time', 'by Monday', 'already'],
    example: 'The train had left before we arrived.',
    translation: 'Поезд ушёл до того, как мы приехали.',
    commonMistake: 'Past Perfect нужен для более раннего события; последующее обычно остаётся в Past Simple. После had — только V3.',
    matchers: [
      /\b(?:past\s+perfect)(?!\s+(?:continuous|progressive))\b/iu,
    ],
  },
  {
    id: 'past-perfect-continuous',
    name: 'Past Perfect Continuous',
    short: 'Процесс длился до определённого момента в прошлом.',
    formula: 'had been + V-ing',
    auxiliary: 'had been',
    negative: 'had not been + V-ing',
    question: 'Had + subject + been + V-ing?',
    uses: ['важна длительность до прошлого момента', 'объяснение видимого результата в прошлом', 'длительный фон перед другим событием'],
    signals: ['for six months', 'for a long time', 'since 7 o’clock', 'before', 'by the time'],
    example: 'He had been working for hours before the break.',
    translation: 'Он работал несколько часов до перерыва.',
    commonMistake: 'Форма состоит из had been и V-ing: had been working, не had been worked.',
    matchers: [
      /\b(?:past\s+perfect\s+(?:continuous|progressive)|perfect\s+continuous\s+past)\b/iu,
    ],
  },
  {
    id: 'future-simple',
    name: 'Future Simple',
    short: 'Решение, обещание, прогноз или факт о будущем.',
    formula: 'will + V',
    auxiliary: 'will',
    negative: 'will not / won’t + V',
    question: 'Will + subject + V?',
    uses: ['решение принято в момент речи', 'обещание, предложение или предупреждение', 'нейтральный прогноз о будущем'],
    signals: ['tomorrow', 'next summer', 'in ten years', 'soon', 'I think'],
    example: 'I will call you after work.',
    translation: 'Я позвоню тебе после работы.',
    commonMistake: 'После will всегда идёт начальная форма: will go, не will goes и не will to go.',
    matchers: [
      /\b(?:future\s+simple|simple\s+future)\b/iu,
    ],
  },
  {
    id: 'future-continuous',
    name: 'Future Continuous',
    short: 'Процесс будет идти в определённый момент будущего.',
    formula: 'will be + V-ing',
    auxiliary: 'will be',
    negative: 'will not be + V-ing',
    question: 'Will + subject + be + V-ing?',
    uses: ['процесс в конкретное время в будущем', 'вежливый вопрос о планах без давления', 'естественное развитие запланированной ситуации'],
    signals: ['at 5 tomorrow', 'this time tomorrow', 'at this moment next week', 'in an hour'],
    example: 'This time tomorrow, we will be flying home.',
    translation: 'Завтра в это время мы будем лететь домой.',
    commonMistake: 'Continuous требует be + V-ing: will be working, не will working.',
    matchers: [
      /\b(?:future\s+(?:continuous|progressive)|continuous\s+future)\b/iu,
    ],
  },
  {
    id: 'future-perfect',
    name: 'Future Perfect',
    short: 'Действие завершится к определённому моменту в будущем.',
    formula: 'will have + V3',
    auxiliary: 'will have',
    negative: 'will not have + V3',
    question: 'Will + subject + have + V3?',
    uses: ['результат будет готов к дедлайну', 'оценка будущего с точки отсчёта', 'действие завершится раньше другого будущего события'],
    signals: ['by Friday', 'by then', 'by the time', 'by Sunday', 'by 2050'],
    example: 'By June, she will have finished the course.',
    translation: 'К июню она закончит курс.',
    commonMistake: 'После have нужна третья форма глагола: will have done, не will have did.',
    matchers: [
      /\b(?:future\s+perfect)(?!\s+(?:continuous|progressive))\b/iu,
    ],
  },
  {
    id: 'future-perfect-continuous',
    name: 'Future Perfect Continuous',
    short: 'К моменту в будущем процесс будет длиться уже некоторое время.',
    formula: 'will have been + V-ing',
    auxiliary: 'will have been',
    negative: 'will not have been + V-ing',
    question: 'Will + subject + have been + V-ing?',
    uses: ['важна продолжительность к будущему моменту', 'подчёркивается накопленная длительность', 'оценка процесса до будущего дедлайна'],
    signals: ['by the end of the day', 'till / until', 'for two hours by', 'by next year'],
    example: 'By next month, I will have been working here for a year.',
    translation: 'В следующем месяце будет год, как я здесь работаю.',
    commonMistake: 'Полная цепочка обязательна: will have been waiting.',
    matchers: [
      /\b(?:future\s+perfect\s+(?:continuous|progressive)|perfect\s+continuous\s+future)\b/iu,
    ],
  },
]

export const tenseById = new Map(tenses.map(tense => [tense.id, tense]))

export const tenseFamilies = [
  { name: 'Simple', meaning: 'факт, привычка или завершённое событие' },
  { name: 'Continuous', meaning: 'процесс в момент времени' },
  { name: 'Perfect', meaning: 'результат или приоритет одного события' },
  { name: 'Perfect Continuous', meaning: 'длительность процесса до момента' },
] as const

export function detectTenses(text: string): TenseDefinition[] {
  const detected = tenses.filter(tense => tense.matchers.some(matcher => matcher.test(text)))
  const hasExplicitFuture = detected.some(tense => tense.id.startsWith('future-'))

  if (!hasExplicitFuture && /\bfuture(?:\s+tense)?\b/iu.test(text)) {
    const futureSimple = tenseById.get('future-simple')
    if (futureSimple)
      detected.push(futureSimple)
  }

  return detected
}
