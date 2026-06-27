import { mulberry32, hashSeed } from '../lib/rng.js'
import { GOAL } from '../data/seed.js'

const STEP = 5 // a new chapter unlocks every 5 reps
export const CHAPTER_COUNT = GOAL / STEP + 1 // 0,5,…,60 → 13 chapters

// Themes inferred from the habit title — each gives the procedural narrative a
// consistent flavour without any server call.
const THEMES = {
  sport: {
    hero: 'the Contender',
    place: 'the high arena',
    beats: [
      'Your hands remember what your mind forgets.',
      'The crowd is only noise now; the rhythm is everything.',
      'Each repetition files another edge off the doubt.',
      'Muscle becomes memory, memory becomes instinct.',
      'The body argues, then agrees, then asks for more.',
    ],
  },
  study: {
    hero: 'the Scholar',
    place: 'the lantern-lit archive',
    beats: [
      'A page that blurred yesterday now reads like a map.',
      'The hard ideas stop biting and start to behave.',
      'You stack one understanding on the last like dry stone.',
      'What was memorised is quietly becoming known.',
      'The exam shrinks from a dragon to a doorway.',
    ],
  },
  care: {
    hero: 'the Keeper',
    place: 'the lamplit workshop',
    beats: [
      'Order returns to the small kingdom you tend.',
      'The work is humble and the result is gleaming.',
      'Care, repeated, looks a lot like respect.',
      'Nothing dramatic — just things, kept right.',
      'The ritual steadies more than the object.',
    ],
  },
  default: {
    hero: 'the Climber',
    place: 'the long ridge',
    beats: [
      'The trail steepens, and so do you.',
      'Fog lifts to reveal how far the valley has fallen away.',
      'You stop counting steps and start trusting them.',
      'The summit is no longer a rumour; it has an outline.',
      'Weather turns, you turn with it, you keep climbing.',
    ],
  },
}

function pickTheme(title) {
  const t = title.toLowerCase()
  if (/throw|run|gym|ball|bike|swim|push|lift|sprint|jump|sport|train/.test(t)) return THEMES.sport
  if (/chem|paper|study|exam|edexcel|read|math|physics|bio|revis|note|essay/.test(t)) return THEMES.study
  if (/clean|tidy|helmet|wash|organi|polish|dust|laundry|dish|care|fix/.test(t)) return THEMES.care
  return THEMES.default
}

/**
 * Build the full Quest Book for a habit. Returns all chapters with the rep
 * count at which each unlocks; the UI reveals only those already reached.
 */
export function generateQuest(habit) {
  const theme = pickTheme(habit.title)
  const rand = mulberry32(hashSeed('quest:' + habit.title))
  const chapters = []

  for (let i = 0; i < CHAPTER_COUNT; i++) {
    const unlockAtReps = i * STEP
    let text
    let title
    if (i === 0) {
      title = 'Chapter I — The Call'
      text = `It begins, as these things do, with a small decision: to face “${habit.title}” not once, but sixty times. ${theme.hero} sets out from ${theme.place}, pack light, intentions heavy. No grand vow — just the next rep, and the one after that.`
    } else if (i === CHAPTER_COUNT - 1) {
      title = `Chapter ${roman(i + 1)} — The Summit`
      text = `Sixty. ${theme.hero} stands where the air is thin and clean, “${habit.title}” no longer a chore but a part of the bones. The climb that once looked impossible is now simply the way down is for someone who has changed. The mountain keeps the habit; you keep the strength it gave you.`
    } else {
      const beat = theme.beats[Math.floor(rand() * theme.beats.length)]
      title = `Chapter ${roman(i + 1)}`
      text = `${unlockAtReps} reps deep into “${habit.title}.” ${beat} ${forwardLine(rand, GOAL - unlockAtReps)}`
    }
    chapters.push({ index: i, unlockAtReps, title, text })
  }
  return { title: questTitle(habit), chapters }
}

function questTitle(habit) {
  return `The Quest of ${habit.title}`
}

function forwardLine(rand, repsLeft) {
  const lines = [
    `${repsLeft} to go, and the path is yours.`,
    `The ridge ahead is shorter than the one behind.`,
    `You are ${repsLeft} reps from the summit — keep the pace.`,
    `Tomorrow's rep is already half-earned by today's.`,
  ]
  return lines[Math.floor(rand() * lines.length)]
}

export function unlockedChapters(quest, habit) {
  return quest.chapters.filter((c) => habit.reps >= c.unlockAtReps)
}

export function nextChapter(quest, habit) {
  return quest.chapters.find((c) => habit.reps < c.unlockAtReps) || null
}

function roman(n) {
  const map = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ]
  let out = ''
  for (const [v, s] of map) {
    while (n >= v) {
      out += s
      n -= v
    }
  }
  return out
}
