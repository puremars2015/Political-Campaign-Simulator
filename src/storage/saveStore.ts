import { GAME_STATE_SCHEMA_VERSION, type GameState } from '../engine/types.ts';

export const SAVE_KEY = 'campaign-office/save/v1';

export interface SaveEnvelope {
  schemaVersion: number;
  contentVersion: string;
  savedAt: string;
  state: GameState;
}

export type LoadResult =
  | { status: 'empty' }
  | { status: 'ok'; state: GameState }
  | { status: 'corrupt'; message: string }
  | { status: 'incompatible'; message: string };

export type SaveResult = { ok: true } | { ok: false; message: string };

/** 可替換的存檔介面；首版實作為 localStorage，日後可換成其他後端。 */
export interface SaveStore {
  load(): LoadResult;
  save(state: GameState): SaveResult;
  clear(): void;
}

/** 只需要 Storage 的子集合，方便在測試中注入假物件。 */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function createLocalSaveStore(
  storage: KeyValueStorage,
  contentVersion: string,
  now: () => Date = () => new Date(),
): SaveStore {
  return {
    load() {
      let raw: string | null;
      try {
        raw = storage.getItem(SAVE_KEY);
      } catch (error) {
        return { status: 'corrupt', message: `無法讀取存檔：${String(error)}` };
      }
      if (raw === null) return { status: 'empty' };

      let envelope: Partial<SaveEnvelope>;
      try {
        envelope = JSON.parse(raw) as Partial<SaveEnvelope>;
      } catch {
        return { status: 'corrupt', message: '存檔內容損壞，無法解析。' };
      }
      if (!envelope || typeof envelope !== 'object' || !envelope.state) {
        return { status: 'corrupt', message: '存檔缺少遊戲狀態。' };
      }
      // 尚無遷移程式；版本不符時明確告知，不靜默重置
      if (envelope.schemaVersion !== GAME_STATE_SCHEMA_VERSION) {
        return {
          status: 'incompatible',
          message: `存檔格式版本 ${String(envelope.schemaVersion)} 與目前版本 ${GAME_STATE_SCHEMA_VERSION} 不相容。`,
        };
      }
      if (envelope.contentVersion !== contentVersion) {
        return {
          status: 'incompatible',
          message: `存檔使用的內容版本 ${String(envelope.contentVersion)} 與目前版本 ${contentVersion} 不同。`,
        };
      }
      return { status: 'ok', state: envelope.state };
    },

    save(state) {
      const envelope: SaveEnvelope = {
        schemaVersion: state.schemaVersion,
        contentVersion: state.contentVersion,
        savedAt: now().toISOString(),
        state,
      };
      try {
        storage.setItem(SAVE_KEY, JSON.stringify(envelope));
        return { ok: true };
      } catch (error) {
        return { ok: false, message: `存檔失敗：${String(error)}` };
      }
    },

    clear() {
      try {
        storage.removeItem(SAVE_KEY);
      } catch {
        // 清除失敗不影響目前畫面；下次載入時仍會回報實際狀態
      }
    },
  };
}
