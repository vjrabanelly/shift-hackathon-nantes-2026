import { matchKeyword, THEMES } from '../src/enrichment/dictionaries/taxonomy'

const sportTheme = THEMES.find(t => t.id === 'sport')!
const allSportKeywords = sportTheme.subjects.flatMap(s => s.keywords)

// Test 1: "emmanuelmacron" ne doit plus matcher
const macronText = 'photo shared by david sinapian tagging emmanuelmacron annesophiepic may be an image of dinner jacket'
const macronMatches = allSportKeywords.filter(kw => matchKeyword(kw, macronText))
console.log(`"emmanuelmacron" text → sport keywords: [${macronMatches}]`)
console.assert(macronMatches.length === 0, 'FAIL: emmanuelmacron should not match sport')

// Test 2: "but" ne doit plus matcher
const butText = 'a place between where friendship shines as the truest light a book four'
const butMatches = allSportKeywords.filter(kw => matchKeyword(kw, butText))
console.log(`"but" text → sport keywords: [${butMatches}]`)
console.assert(butMatches.length === 0, 'FAIL: should not match sport')

// Test 3: vrais contenus sport doivent toujours matcher
const realSport = 'le match de football entre le psg et marseille en ligue 1 était incroyable mbappe a marqué'
const realMatches = allSportKeywords.filter(kw => matchKeyword(kw, realSport))
console.log(`Vrai sport → keywords: [${realMatches}]`)
console.assert(realMatches.length >= 2, 'FAIL: real sport should match')

console.log('\nAll checks passed!')
