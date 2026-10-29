import { useState } from 'react';
import {
  FRAMING_ANGLES,
  RISK_LABELS,
  STRENGTH_LABELS,
  remainingRisks,
  type FramingAngle,
  type PolicyAssessment,
} from '../content/assess.ts';
import type { ContentBundle, Policy } from '../content/schema.ts';
import { EXPOSURE_COSTS } from '../engine/config.ts';
import type { CampaignPolicyState, ExposureStatus } from '../engine/types.ts';
import { PolicyCard } from './PolicyCard.tsx';
import { EXPOSURE_LABELS } from './labels.ts';

type Choice = Exclude<ExposureStatus, 'pending' | 'internal'>;

interface Props {
  content: ContentBundle;
  policy: Policy;
  assessment: PolicyAssessment;
  /** 進行中的局才有；確認頁只顯示評估 */
  entry?: CampaignPolicyState;
  canAfford?: (status: Choice) => boolean;
  onChoose?: (status: Choice, angle: FramingAngle | null) => void;
}

function candidacyName(content: ContentBundle, candidacyId: string): string {
  const candidacy = content.candidacies.find((c) => c.id === candidacyId);
  return content.people.find((p) => p.id === candidacy?.personId)?.name ?? candidacyId;
}

/** 政見策略室的一張卡：原文、對手同議題政見、幕僚評估與處理方式 */
export function StrategyCard({ content, policy, assessment, entry, canAfford, onChoose }: Props) {
  const [angle, setAngle] = useState<FramingAngle>(assessment.suggestedAngle ?? assessment.angles[0] ?? 'vision');
  const opponents = assessment.opponentPolicyIds
    .map((id) => content.policies.find((p) => p.id === id))
    .filter((p): p is Policy => !!p);
  const afterAngle = remainingRisks(assessment, angle);

  return (
    <article className="card strategy">
      {entry && (
        <p>
          目前處理：<strong>{EXPOSURE_LABELS[entry.status]}</strong>
          {entry.angle && `（${FRAMING_ANGLES[entry.angle].label}）`}
        </p>
      )}
      <PolicyCard content={content} policy={policy} />
      {policy.origin === 'government-plan' && <p className="cost">市府計畫：以市府名義宣布、尚未完成。</p>}

      <details>
        <summary>
          對手在「{content.topics.find((t) => t.id === policy.topic)?.name ?? policy.topic}」的政見（{opponents.length}）
        </summary>
        {opponents.length === 0 ? (
          <p>對手在這個議題尚未收錄政見。</p>
        ) : (
          opponents.map((p) => (
            <div key={p.id}>
              <p className="eyebrow">{candidacyName(content, p.candidacyId)}</p>
              <PolicyCard content={content} policy={p} />
            </div>
          ))
        )}
      </details>

      <section className="assessment" aria-label="幕僚評估">
        <p className="eyebrow">幕僚評估（遊戲模型推論）</p>
        <ul>
          {assessment.strengths.map((s) => (
            <li key={s}>優勢：{STRENGTH_LABELS[s]}</li>
          ))}
          {assessment.risks.map((r) => (
            <li key={r}>風險：{RISK_LABELS[r]}</li>
          ))}
        </ul>
        <p>
          建議：<strong>{EXPOSURE_LABELS[assessment.suggestion]}</strong>
          {assessment.suggestedAngle && `，用「${FRAMING_ANGLES[assessment.suggestedAngle].label}」的角度`}
        </p>
      </section>

      {onChoose && canAfford && (
        <div className="strategy-actions">
          <button
            type="button"
            disabled={!canAfford('featured')}
            onClick={() => onChoose('featured', null)}
          >
            大張旗鼓：{policy.issue}
          </button>
          <p className="cost">
            成本 {EXPOSURE_COSTS.featured.actionPoints} 行動點、{EXPOSURE_COSTS.featured.funds} 萬元。
            {assessment.risks.length > 0 && `${assessment.risks.length} 項風險未處理，之後可能被追問。`}
          </p>

          <label className="angle">
            包裝角度
            <select value={angle} onChange={(e) => setAngle(e.target.value as FramingAngle)}>
              {assessment.angles.map((a) => (
                <option key={a} value={a}>
                  {FRAMING_ANGLES[a].label}
                </option>
              ))}
            </select>
          </label>
          <p className="cost">
            {FRAMING_ANGLES[angle].description}。
            {afterAngle.length === 0 ? '可化解目前所有風險。' : `仍有 ${afterAngle.length} 項風險。`}
          </p>
          <button
            type="button"
            disabled={!canAfford('reframed')}
            onClick={() => onChoose('reframed', angle)}
          >
            圓滑包裝：{policy.issue}
          </button>

          <div className="button-row">
            <button type="button" onClick={() => onChoose('low-profile', null)}>
              吞下去：{policy.issue}
            </button>
            <button type="button" onClick={() => onChoose('deferred', null)}>
              先擱著：{policy.issue}
            </button>
          </div>
          {assessment.opponentPolicyIds.length > 0 && (
            <p className="cost">對手在同議題有政見，低調處理等於讓出這個話題。</p>
          )}
        </div>
      )}
    </article>
  );
}
