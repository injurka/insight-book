export interface DifficultyLevel {
  value: string
  label: string
  level: number // От 1 (самый легкий) до 6 (самый сложный)
}

export const DIFFICULTY_SYSTEMS: Record<string, DifficultyLevel[]> = {
  // Универсальная система уровней для вкладки "Все языки"
  all: [
    { value: 'level_1', label: 'Начальный', level: 1 },
    { value: 'level_2', label: 'Базовый', level: 2 },
    { value: 'level_3', label: 'Средний', level: 3 },
    { value: 'level_4', label: 'Выше среднего', level: 4 },
    { value: 'level_5', label: 'Продвинутый', level: 5 },
    { value: 'level_6', label: 'Владение', level: 6 },
  ],
  // Для европейских языков (Английский, Французский, Немецкий и т.д.)
  default: [
    { value: 'A1', label: 'A1', level: 1 },
    { value: 'A2', label: 'A2', level: 2 },
    { value: 'B1', label: 'B1', level: 3 },
    { value: 'B2', label: 'B2', level: 4 },
    { value: 'C1', label: 'C1', level: 5 },
    { value: 'C2', label: 'C2', level: 6 },
  ],
  // Для китайского
  zh: [
    { value: 'HSK 1', label: 'HSK 1', level: 1 },
    { value: 'HSK 2', label: 'HSK 2', level: 2 },
    { value: 'HSK 3', label: 'HSK 3', level: 3 },
    { value: 'HSK 4', label: 'HSK 4', level: 4 },
    { value: 'HSK 5', label: 'HSK 5', level: 5 },
    { value: 'HSK 6', label: 'HSK 6+', level: 6 },
  ],
  // Для японского
  ja: [
    { value: 'N5', label: 'JLPT N5', level: 1 },
    { value: 'N4', label: 'JLPT N4', level: 2 },
    { value: 'N3', label: 'JLPT N3', level: 3 },
    { value: 'N2', label: 'JLPT N2', level: 4 },
    { value: 'N1', label: 'JLPT N1', level: 6 },
  ],
}
