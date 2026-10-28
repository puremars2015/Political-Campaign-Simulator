/**
 * 可序列化狀態的亂數產生器（mulberry32）。
 * 引擎內所有隨機抽樣都必須透過這裡，並把新狀態寫回 GameState，
 * 以確保相同種子與選擇序列能重現相同結果。
 */
export type RngState = number;

export function seedRng(seed: string | number): RngState {
  if (typeof seed === 'number') return seed >>> 0;
  // FNV-1a，將文字種子轉成 32 位元整數
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** 回傳 [0, 1) 的亂數與下一個狀態。 */
export function nextFloat(state: RngState): [number, RngState] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}

/** 回傳 [min, max] 閉區間整數與下一個狀態。 */
export function nextInt(state: RngState, min: number, max: number): [number, RngState] {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    throw new RangeError(`無效的整數範圍：${min}..${max}`);
  }
  const [value, next] = nextFloat(state);
  return [min + Math.floor(value * (max - min + 1)), next];
}

export function pickOne<T>(state: RngState, items: readonly T[]): [T, RngState] {
  if (items.length === 0) throw new RangeError('無法從空陣列抽取');
  const [index, next] = nextInt(state, 0, items.length - 1);
  return [items[index] as T, next];
}
