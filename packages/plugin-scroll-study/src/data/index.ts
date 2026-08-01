import type { CharacterData } from './types'

import tier0Data from './tier/tier0.json'
import tier1Data from './tier/tier1.json'
import tier2Data from './tier/tier2.json'
import tier3Data from './tier/tier3.json'

export * from './types'

export const tier0 = tier0Data as CharacterData[]
export const tier1 = tier1Data as CharacterData[]
export const tier2 = tier2Data as CharacterData[]
export const tier3 = tier3Data as CharacterData[]

export const allCharacters: CharacterData[] = [...tier0, ...tier1, ...tier2, ...tier3]
