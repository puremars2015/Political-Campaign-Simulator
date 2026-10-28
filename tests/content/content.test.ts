import { describe, expect, it } from 'vitest';
import { rawContent } from '../../src/content/index.ts';
import { validateContent } from '../../src/content/validate.ts';

function clone<T>(value: T): T {
  return structuredClone(value);
}

describe('內建內容', () => {
  it('通過 schema 與引用驗證', () => {
    const result = validateContent(rawContent);
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

describe('validateContent', () => {
  it('指出不存在的選區引用', () => {
    const broken = clone(rawContent);
    broken.candidates[0]!.districtId = 'missing-district';
    const result = validateContent(broken);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes('missing-district'))).toBe(true);
  });

  it('指出重複的事件 ID', () => {
    const broken = clone(rawContent);
    broken.events.push(clone(broken.events[0]!));
    const result = validateContent(broken);
    expect(result.issues.some((i) => i.message.includes('ID 重複'))).toBe(true);
  });

  it('指出不存在的後續事件', () => {
    const broken = clone(rawContent);
    Object.assign(broken.events[0]!.choices[0]!, { followUpEventId: 'ghost-event' });
    const result = validateContent(broken);
    expect(result.issues.some((i) => i.message.includes('ghost-event'))).toBe(true);
  });

  it('要求每個事件至少有一個零成本選項', () => {
    const broken = clone(rawContent);
    for (const choice of broken.events[0]!.choices) choice.cost.funds = 10;
    const result = validateContent(broken);
    expect(result.issues.some((i) => i.message.includes('零成本'))).toBe(true);
  });

  it('拒絕超出12回合的觸發窗口', () => {
    const broken = clone(rawContent);
    broken.events[0]!.window.toRound = 13;
    expect(validateContent(broken).ok).toBe(false);
  });

  it('schema 錯誤時回報欄位路徑', () => {
    const broken = clone(rawContent);
    (broken.districts[0] as { fictional: boolean }).fictional = false;
    const result = validateContent(broken);
    expect(result.ok).toBe(false);
    expect(result.issues[0]?.path).toBe('districts.0.fictional');
  });
});
