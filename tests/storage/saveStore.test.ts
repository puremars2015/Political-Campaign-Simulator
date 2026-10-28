import { describe, expect, it } from 'vitest';
import { createNewGame, type NewGameOptions } from '../../src/engine/engine.ts';
import { loadFixture } from '../fixtures/content.ts';
import { SAVE_KEY, createLocalSaveStore, type KeyValueStorage } from '../../src/storage/saveStore.ts';

const content = loadFixture();
const game = (seed: string) =>
  createNewGame(content, { seed, districtId: 'test-city', candidacyId: 'cand-a' } satisfies NewGameOptions);

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

describe('localStorage 存檔', () => {
  it('沒有存檔時回報 empty', () => {
    expect(createLocalSaveStore(memoryStorage(), content.contentVersion).load()).toEqual({ status: 'empty' });
  });

  it('存檔後可完整讀回', () => {
    const store = createLocalSaveStore(memoryStorage(), content.contentVersion);
    const state = game('save');
    expect(store.save(state)).toEqual({ ok: true });
    expect(store.load()).toEqual({ status: 'ok', state });
  });

  it('損壞的存檔回報 corrupt，而不是拋錯或重置', () => {
    const storage = memoryStorage();
    storage.data.set(SAVE_KEY, '{not json');
    expect(createLocalSaveStore(storage, content.contentVersion).load().status).toBe('corrupt');
  });

  it('內容版本不同時回報 incompatible', () => {
    const storage = memoryStorage();
    createLocalSaveStore(storage, content.contentVersion).save(game('v'));
    expect(createLocalSaveStore(storage, 'other-version').load().status).toBe('incompatible');
  });

  it('schema 版本不同時回報 incompatible', () => {
    const storage = memoryStorage();
    const store = createLocalSaveStore(storage, content.contentVersion);
    store.save({ ...game('v'), schemaVersion: 999 });
    expect(store.load().status).toBe('incompatible');
  });

  it('寫入失敗時回報錯誤，而不是假裝已保存', () => {
    const storage = memoryStorage();
    storage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    const result = createLocalSaveStore(storage, content.contentVersion).save(game('q'));
    expect(result.ok).toBe(false);
  });
});
