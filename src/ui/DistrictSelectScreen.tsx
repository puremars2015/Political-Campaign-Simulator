import { startableMode } from '../content/query.ts';
import type { ContentBundle, District } from '../content/schema.ts';
import { DISTRICT_STATUS_LABELS } from './labels.ts';

interface Props {
  content: ContentBundle;
  onSelect: (districtId: string) => void;
  onBack: () => void;
}

const GROUPS: { kind: District['kind']; title: string }[] = [
  { kind: 'municipality', title: '六都' },
  { kind: 'provincial-city', title: '其餘市' },
  { kind: 'county', title: '縣' },
];

export function DistrictSelectScreen({ content, onSelect, onBack }: Props) {
  return (
    <main className="screen">
      <header>
        <p className="eyebrow">第一步</p>
        <h1>選擇縣市</h1>
        <p className="dates">2026年直轄市長及縣市長選舉。尚未完成資料查證的縣市可查看進度，但不能開始遊戲。</p>
      </header>

      {GROUPS.map((group) => (
        <section key={group.kind} aria-labelledby={`group-${group.kind}`}>
          <h2 id={`group-${group.kind}`}>{group.title}</h2>
          <ul className="district-list">
            {content.districts
              .filter((d) => d.kind === group.kind)
              .map((district) => {
                const { mode } = startableMode(content, district);
                return (
                  <li key={district.id}>
                    <button type="button" className="district" onClick={() => onSelect(district.id)}>
                      <span className="district-name">{district.name}</span>
                      <span className="cost">
                        {mode === 'formal' ? '可遊玩' : mode === 'preview' ? '預覽可玩' : DISTRICT_STATUS_LABELS[district.status]}
                        {district.dataAsOf && `・資料截至 ${district.dataAsOf}`}
                      </span>
                    </button>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}

      <button type="button" onClick={onBack}>
        返回
      </button>
    </main>
  );
}
