export const POS_TAGS_MAP: Record<string, string> = {
  // ----- Общие теги (Английский, Японский, Китайский) -----
  n: 'posTags.n',
  v: 'posTags.v',
  a: 'posTags.a',
  d: 'posTags.d',
  r: 'posTags.r',
  m: 'posTags.m',
  p: 'posTags.p',
  c: 'posTags.c',
  u: 'posTags.u',
  x: 'posTags.x',
  unk: 'posTags.unk',
  word: 'posTags.word',

  // ----- Специфичные для Китайского (Jieba / ICTCLAS) -----

  // Существительные и имена собственные
  nr: 'posTags.nr',
  ns: 'posTags.ns',
  nt: 'posTags.nt',
  nz: 'posTags.nz',
  nrt: 'posTags.nrt',
  ng: 'posTags.ng',

  // Глаголы и отглагольные слова
  vn: 'posTags.vn',
  vd: 'posTags.vd',
  vg: 'posTags.vg',

  // Прилагательные и наречия
  ad: 'posTags.ad',
  an: 'posTags.an',
  ag: 'posTags.ag',
  dg: 'posTags.dg',
  b: 'posTags.b',
  z: 'posTags.z',
  zg: 'posTags.zg',

  // Числительные и счетные слова
  q: 'posTags.q',
  mq: 'posTags.mq',

  // Местоимения, время, локативы
  f: 'posTags.f',
  s: 'posTags.s',
  t: 'posTags.t',
  tg: 'posTags.tg',

  // Частицы (очень важно для китайского)
  uj: 'posTags.uj',
  uv: 'posTags.uv',
  ud: 'posTags.ud',
  ug: 'posTags.ug',
  ul: 'posTags.ul',
  uz: 'posTags.uz',
  y: 'posTags.y',
  e: 'posTags.e',
  o: 'posTags.o',

  // Аффиксы, сокращения и устойчивые выражения
  h: 'posTags.h',
  k: 'posTags.k',
  i: 'posTags.i',
  l: 'posTags.l',
  j: 'posTags.j',

  // Прочее
  eng: 'posTags.eng',
}
