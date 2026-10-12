import { FSRS, createEmptyCard, Rating } from '../../apps/client/node_modules/ts-fsrs'
const scheduler = new FSRS({})
export function intervals(data, now = new Date()) {
 const card = Object.assign(createEmptyCard(now), {due: new Date(data.due), stability: data.stability, difficulty: data.difficultyFsrs, scheduled_days: data.scheduledDays, reps: data.reps, lapses: data.lapses, state: data.state, last_review: data.lastReview ? new Date(data.lastReview) : undefined, learning_steps: data.learningSteps ?? 0})
 const results = scheduler.repeat(card, now)
 return [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy].map(rating => {
 const next = results[rating].card, days = next.scheduled_days
 if (days === 0) { const minutes = Math.round((next.due.getTime() - now.getTime()) / 60000); return minutes > 0 ? minutes + ' м' : '<1 м' }
 return days < 30 ? Math.round(days) + ' дн' : days < 365 ? Math.round(days / 30) + ' мес' : Math.round(days / 365) + ' г'
 })
}
