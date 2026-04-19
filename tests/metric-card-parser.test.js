/**
 * Test fixture for the exec summary metric card parser.
 *
 * Exercises the two parsing stages:
 *   1. Comma split: split(/,\s+/) — must preserve thousands separators (no space after comma)
 *   2. Value regex: captures currency symbols, decimals, ranges, units
 *
 * Run: node tests/metric-card-parser.test.js
 */

// --- Parser extracted from App.jsx (lines ~10815-10823) ---

function parseMetricCards(phrase) {
  const cleaned = phrase.replace(/^Key metrics:\s*/i, '').replace(/\s*\([^)]*\)\.?\s*$/, '')
  const sentences = cleaned.split(/,\s+/).map(s => s.replace(/^and\s+/i, '').trim()).filter(s => s && /\d/.test(s))
  return sentences.map(s => {
    const t = s.replace(/\.$/, '')
    const numMatch = t.match(/((?:~\s*)?[$£€¥]?\d[\d,]*(?:\.\d+)?(?:\s*[\-–]\s*(?:~\s*)?[$£€¥]?\d[\d,]*(?:\.\d+)?)?%?\+?(?:\s*(?:trillion|billion|million|thousand|T|B|M|K|k))?)/)
    if (!numMatch) return null
    const value = numMatch[0]
    const label = t.replace(value, '').replace(/^\s*[:\-–—~]\s*/, '').trim()
    return { value, label: label.charAt(0).toUpperCase() + label.slice(1) }
  }).filter(Boolean)
}

// --- Headline split extracted from App.jsx (lines ~10802-10805) ---

function splitHeadline(phrase) {
  const sentenceEnd = phrase.match(/(?<![A-Z])\.(?:\s+)(?=[A-Z][a-z])/)
  const firstDot = sentenceEnd ? sentenceEnd.index : -1
  if (firstDot > 0 && firstDot < phrase.length - 1) {
    return {
      headline: phrase.substring(0, firstDot + 1),
      rest: phrase.substring(firstDot + 1).trim()
    }
  }
  return { headline: phrase, rest: '' }
}

// --- Test cases ---

const tests = []
let passed = 0
let failed = 0

function test(name, fn) {
  tests.push({ name, fn })
}

function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${msg}\n  expected: ${e}\n  actual:   ${a}`)
}

// Metric card tests

test('$4.5 billion keeps currency and unit together', () => {
  const r = parseMetricCards('Key metrics: $4.5 billion peak single-day trading volume')
  assertEqual(r.length, 1, 'count')
  assertEqual(r[0].value, '$4.5 billion', 'value')
  assertEqual(r[0].label, 'Peak single-day trading volume', 'label')
})

test('$50,000–$100,000 range preserved (thousands separator)', () => {
  const r = parseMetricCards('Key metrics: $50,000–$100,000 potential loss per mismanaged exception')
  assertEqual(r.length, 1, 'count')
  assertEqual(r[0].value, '$50,000–$100,000', 'value')
})

test('~$2M keeps approximation and unit', () => {
  const r = parseMetricCards('Key metrics: ~$2M annual savings expected')
  assertEqual(r.length, 1, 'count')
  assertEqual(r[0].value, '~$2M', 'value')
})

test('percentage preserved', () => {
  const r = parseMetricCards('Key metrics: 60% reduction in manual operations')
  assertEqual(r.length, 1, 'count')
  assertEqual(r[0].value, '60%', 'value')
})

test('comma split requires space — thousands separators preserved', () => {
  const r = parseMetricCards('Key metrics: $100,000 annual cost, 5 employees affected')
  assertEqual(r.length, 2, 'count')
  assertEqual(r[0].value, '$100,000', 'value 0')
  assertEqual(r[1].value, '5', 'value 1')
})

test('24/7/365, 2–3 years splits into two fragments', () => {
  const r = parseMetricCards('Key metrics: 5 support staff covering a 24/5 trading week with planned expansion to 24/7/365, 2–3 years required to train a new support staffer')
  assertEqual(r.length, 2, 'count')
  assertEqual(r[1].value, '2–3', 'value 1 (range)')
})

test('full MFP Trading metric line', () => {
  const r = parseMetricCards('Key metrics: $4.5 billion peak single-day trading volume, 5 support staff covering a 24/5 trading week with planned expansion to 24/7/365, 2–3 years required to train a new support staffer to competency, and $50,000–$100,000 potential loss per mismanaged exception in seconds.')
  assertEqual(r.length, 4, 'count')
  assertEqual(r[0].value, '$4.5 billion', 'value 0')
  assertEqual(r[1].value, '5', 'value 1')
  assertEqual(r[2].value, '2–3', 'value 2')
  assertEqual(r[3].value, '$50,000–$100,000', 'value 3')
})

test('trillion unit', () => {
  const r = parseMetricCards('Key metrics: $1.2 trillion in assets under management')
  assertEqual(r[0].value, '$1.2 trillion', 'value')
})

test('¥ currency', () => {
  const r = parseMetricCards('Key metrics: ¥500,000 quarterly revenue')
  assertEqual(r[0].value, '¥500,000', 'value')
})

test('£ currency with thousand unit', () => {
  const r = parseMetricCards('Key metrics: £50 thousand monthly spend')
  assertEqual(r[0].value, '£50 thousand', 'value')
})

// Headline split tests

test('headline does not split on decimal in $4.5 billion', () => {
  const r = splitHeadline("MFP Trading handles up to $4.5 billion in a single day. The firm's bottleneck is exception resolution.")
  assertEqual(r.headline, "MFP Trading handles up to $4.5 billion in a single day.", 'headline')
  assertEqual(r.rest, "The firm's bottleneck is exception resolution.", 'rest')
})

test('headline does not split on U.S. acronym', () => {
  const r = splitHeadline("The U.S. Department of Defense spent $4.5 billion. Additional context here.")
  // Should NOT split at "U." or "S." — should split at "billion."
  assertEqual(r.headline.includes('U.S.'), true, 'headline contains U.S.')
  assertEqual(r.headline.endsWith('billion.'), true, 'headline ends at billion.')
})

test('headline with no sentence break returns full phrase', () => {
  const r = splitHeadline("Single sentence with $4.5 billion and no break")
  assertEqual(r.headline, "Single sentence with $4.5 billion and no break", 'headline')
  assertEqual(r.rest, '', 'rest')
})

// Run

for (const t of tests) {
  try {
    t.fn()
    passed++
    console.log(`  ✓ ${t.name}`)
  } catch (e) {
    failed++
    console.log(`  ✗ ${t.name}`)
    console.log(`    ${e.message}`)
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length} tests`)
process.exit(failed > 0 ? 1 : 0)
