export type TagKey = keyof typeof BOOK_TAGS

export const BOOK_TAGS = {
  sci_fi: { ru: 'научная фантастика', en: 'sci-fi', cn: '科幻' },
  fantasy: { ru: 'фэнтези', en: 'fantasy', cn: '奇幻' },
  adventure: { ru: 'приключения', en: 'adventure', cn: '冒险' },
  shounen: { ru: 'сёнэн', en: 'shounen', cn: '少年' },
  shoujo: { ru: 'сёдзё', en: 'shoujo', cn: '少女' },
  seinen: { ru: 'сэйнэн', en: 'seinen', cn: '青年' },
  josei: { ru: 'дзёсэй', en: 'josei', cn: '女性' },
  romance: { ru: 'романтика', en: 'romance', cn: '爱情' },
  comedy: { ru: 'комедия', en: 'comedy', cn: '喜剧' },
  drama: { ru: 'драма', en: 'drama', cn: '剧情' },
  slice_of_life: { ru: 'повседневность', en: 'slice of life', cn: '日常' },
  action: { ru: 'экшен', en: 'action', cn: '动作' },
  thriller: { ru: 'триллер', en: 'thriller', cn: '惊悚' },
  mystery: { ru: 'детектив', en: 'mystery', cn: '悬疑' },
  horror: { ru: 'ужасы', en: 'horror', cn: '恐怖' },
  post_apocalyptic: { ru: 'постапокалипсис', en: 'post-apocalyptic', cn: '末日' },
  cyberpunk: { ru: 'киберпанк', en: 'cyberpunk', cn: '赛博朋克' },
  historical: { ru: 'исторический', en: 'historical', cn: '历史' },
  martial_arts: { ru: 'боевые искусства', en: 'martial arts', cn: '武术' },
  psychological: { ru: 'психология', en: 'psychological', cn: '心理' },
  supernatural: { ru: 'сверхъестественное', en: 'supernatural', cn: '超自然' },
  magic: { ru: 'магия', en: 'magic', cn: '魔法' },
  school: { ru: 'школа', en: 'school', cn: '校园' },
  mecha: { ru: 'меха', en: 'mecha', cn: '机甲' },
  isekai: { ru: 'исекай (попаданцы)', en: 'isekai', cn: '异世界' },
}

export const ALLOWED_TAG_KEYS = Object.keys(BOOK_TAGS)
