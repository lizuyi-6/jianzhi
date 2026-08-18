import type { RenderCard, RenderPacket, Role } from '../api/types';
import { dimensionLabel, valueLabel, ROLE_META } from '../i18n/labels';

// P0-08（F-009）：修改条件后，Reading Set 的变化必须可见、可解释、可验证。
// 这里只做结构 diff（source_id 变化 + 相同/差异维度的重排原因），不引入任何主观解读。

export interface SlotChange {
  role: Role;
  roleLabel: string;
  previousSourceId: string | null;
  nextSourceId: string | null;
  changed: boolean;
  emptied: boolean;
  newlyFilled: boolean;
  reasons: string[];
}

export interface ChangeReport {
  hasChanges: boolean;
  changedCount: number;
  changes: SlotChange[];
}

function cardOf(packet: RenderPacket, role: Role): RenderCard | null {
  return packet.cards.find((card) => card.role === role) ?? null;
}

export function diffRenderPackets(previous: RenderPacket | null, next: RenderPacket, changedConditions: string[] = []): ChangeReport {
  const roles: Role[] = ['COMPARABLE', 'COUNTER_EXPERIENCE', 'CLASSIC'];
  const changes = roles.map((role) => {
    const prevCard = previous ? cardOf(previous, role) : null;
    const nextCard = cardOf(next, role);
    const previousSourceId = prevCard?.source_id ?? null;
    const nextSourceId = nextCard?.source_id ?? null;
    const changed = previousSourceId !== nextSourceId;
    const emptied = Boolean(prevCard) && !nextCard;
    const newlyFilled = !prevCard && Boolean(nextCard);
    const reasons: string[] = [];
    if (changed) {
      if (changedConditions.length > 0) {
        reasons.push('你修改了：' + changedConditions.map((item) => dimensionLabel(item)).join('、'));
      }
      if (emptied) {
        reasons.push('新条件下没有满足该角色、且通过 Evidence 校验的经验，宁缺毋滥');
      } else if (newlyFilled) {
        reasons.push('新条件下找到了通过校验的经验，补齐了该视角');
      } else if (prevCard && nextCard) {
        const gainedSame = nextCard.same_dimensions.filter((id) => !prevCard.same_dimensions.includes(id));
        const lostSame = prevCard.same_dimensions.filter((id) => !nextCard.same_dimensions.includes(id));
        reasons.push('相同条件数 ' + prevCard.same_dimensions.length + ' → ' + nextCard.same_dimensions.length + '，排序规则（相同多者优先）让另一位经验胜出');
        if (gainedSame.length > 0) reasons.push('新经验在这些条件与你一致：' + gainedSame.map((id) => dimensionLabel(id)).join('、'));
        if (lostSame.length > 0) reasons.push('原经验在这些条件不再与你一致：' + lostSame.map((id) => dimensionLabel(id)).join('、'));
      }
    }
    return { role, roleLabel: ROLE_META[role].name, previousSourceId, nextSourceId, changed, emptied, newlyFilled, reasons };
  });
  const changedCount = changes.filter((change) => change.changed).length;
  return { hasChanges: changedCount > 0, changedCount, changes };
}

export function decisionQuoteOf(card: RenderCard): string | null {
  const span = card.evidence.find((item) => item.field === 'decision');
  return span?.quote ?? null;
}

export function factLine(fact: { dimension: string; user_value: string; source_value: string }): string {
  return dimensionLabel(fact.dimension) + '：你「' + valueLabel(fact.user_value) + '」 / TA「' + valueLabel(fact.source_value) + '」';
}
