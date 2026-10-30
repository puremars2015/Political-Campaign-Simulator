import { validateContent } from '../content/validate.ts';
import type { ContentBundle } from '../content/schema.ts';
import { savedStateSchema } from './stateSchema.ts';
import { GAME_STATE_SCHEMA_VERSION, type GameState } from '../engine/types.ts';

export const SAVE_KEY = 'campaign-office/save/v1';

export interface SaveEnvelope {
  schemaVersion: number;
  contentVersion: string;
  savedAt: string;
  state: GameState;
  contentSnapshot?: ContentBundle;
}

export type LoadResult =
  | { status: 'empty' }
  | { status: 'ok'; state: GameState; contentSnapshot?: ContentBundle }
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
  contentSnapshot?: ContentBundle,
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
      const snapshot = envelope.contentSnapshot ? validateContent(envelope.contentSnapshot) : null;
      if (snapshot && (!snapshot.ok || snapshot.bundle.contentVersion !== envelope.contentVersion)) {
        return { status: 'corrupt', message: '存檔的內容快照損壞。' };
      }
      if (envelope.contentVersion !== contentVersion && !snapshot?.ok) {
        return {
          status: 'incompatible',
          message: `存檔使用的內容版本 ${String(envelope.contentVersion)} 與目前版本 ${contentVersion} 不同。`,
        };
      }
      const parsed = savedStateSchema.safeParse(envelope.state);
      if (!parsed.success || envelope.state.schemaVersion !== envelope.schemaVersion ||
          envelope.state.contentVersion !== envelope.contentVersion) {
        return { status: 'corrupt', message: '存檔中的狀態欄位損壞或不一致，無法繼續。' };
      }
      const bundle = snapshot?.ok ? snapshot.bundle : contentSnapshot;
      if (bundle) {
        const state = parsed.data;
        const district = bundle.districts.find((d) => d.id === state.districtId);
        const validCandidate = (id: string) => bundle.candidacies.some((c) => c.id === id && c.districtId === state.districtId);
        if (!district || ![state.candidacyId, ...state.opponentCandidacyIds].every(validCandidate) ||
            state.campaign.some((entry) => !bundle.policies.some((p) => p.id === entry.policyId && p.candidacyId === state.candidacyId)) ||
            (state.activeEvent && !bundle.events.some((e) => e.id === state.activeEvent?.eventId))) {
          return { status: 'corrupt', message: '存檔的縣市、人物或事件與內容快照不一致。' };
        }
      }
      return { status: 'ok', state: parsed.data, ...(snapshot?.ok ? { contentSnapshot: snapshot.bundle } : {}) };
    },

    save(state) {
      const envelope: SaveEnvelope = {
        schemaVersion: state.schemaVersion,
        contentVersion: state.contentVersion,
        savedAt: now().toISOString(),
        state,
        ...(contentSnapshot ? { contentSnapshot } : {}),
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
