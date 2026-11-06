import { useId, type CSSProperties } from 'react';
import { Head, HairBehind } from './girl/face';
import { Clothes, ForeSleeve, Leg, PrintContext, PrintPattern, Sleeve } from './girl/outfit';
import { Effect, HandPropShape, PropShape } from './girl/parts';
import { REST, pickGirl, type Body, type GirlKind, type HappyMove, type HandProp, type Joint, type Prop, type SadMove, type Wear } from './girl/moves';
import './streakGirl.css';

export { pickGirl, MOVE_LISTS } from './girl/moves';
export type { GirlKind } from './girl/moves';

const SHOULDER = { l: 19.6, r: 28.4 };
const GROUND: Prop[] = ['mat', 'belt', 'podium', 'scale', 'bike', 'dumbbell-floor'];
const FRONT: Prop[] = ['pot', 'board', 'chart', 'plate-front'];
const LAP: Prop[] = ['plate-lap', 'rope'];
const HEAD: Prop[] = ['crown'];
const BEHIND = ['glow', 'rainbow'];

function deg(value: number): string {
  return `${value}deg`;
}

function happyVars(move: HappyMove): Record<string, string> {
  const vars: Record<string, string> = {
    '--dur': `${move.dur}s`,
    '--ease': move.ease ?? 'ease-in-out',
  };
  for (const joint of Object.keys(REST) as Joint[]) {
    const value = move[joint] ?? REST[joint];
    const [a, b] = Array.isArray(value) ? value : [value, value];
    vars[`--${joint}-a`] = deg(a);
    vars[`--${joint}-b`] = deg(b);
  }
  for (const part of ['all', 'torso', 'head', 'idle'] as Body[]) {
    const value = move[part] ?? 'none';
    const [a, b] = Array.isArray(value) ? value : [value, value];
    vars[`--${part}-a`] = a;
    vars[`--${part}-b`] = b;
  }
  const [pa, pb] = move.pm ?? ['none', 'none'];
  vars['--pm-a'] = pa;
  vars['--pm-b'] = pb;
  return vars;
}

function sadVars(move: SadMove): Record<string, string> {
  const sit: Partial<Record<Joint, number>> = move.sit ? { tl: 80, sl: -140, tr: -80, sr: 140 } : {};
  const vars: Record<string, string> = {};
  for (const joint of Object.keys(REST) as Joint[]) vars[`--${joint}`] = deg(move[joint] ?? sit[joint] ?? REST[joint]);
  vars['--all'] = move.all ?? (move.sit ? 'translateY(16px)' : 'none');
  vars['--torso'] = move.torso ?? 'none';
  vars['--head'] = move.head ?? 'translateY(2px)';
  vars['--ldur'] = `${move.loop?.dur ?? 2}s`;
  vars['--ldelay'] = move.sit ? '3.4s' : '1.6s';
  for (const part of ['idle', 'head', 'kick'] as const) {
    const [a, b] = move.loop?.[part] ?? ['none', 'none'];
    vars[`--l${part}-a`] = a;
    vars[`--l${part}-b`] = b;
  }
  return vars;
}

type Layer = 'line' | 'fill';

function isLight(hex: string): boolean {
  const value = parseInt(hex.slice(1), 16);
  return 0.299 * (value >> 16) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255) > 190;
}

function Arm({ side, extra, hold, layer, wear }: { side: 'l' | 'r'; extra?: HappyMove['extra']; hold?: HandProp; layer: Layer; wear: Wear }) {
  const skin = layer === 'line' ? 'g-skin-line' : 'g-skin';
  return (
    <g transform={`translate(${SHOULDER[side]} 27)`}>
      <g className={`g-upper g-upper-${side}`}>
        <path className={skin} d="M-1.6 0c-.2 3 0 5.6.3 8h2.6c.3-2.4.5-5 .3-8z" />
        {extra === 'bicep' && <ellipse className={skin} cx={side === 'l' ? 1 : -1} cy="5.6" rx="1.7" ry="2" />}
        <g transform="translate(0 8)">
          <g className={`g-fore g-fore-${side}`}>
            <circle className={skin} cx="0" cy="0" r="1.3" />
            <path className={skin} d="M-1.3 0c-.1 3.6.1 6.6.35 9h1.9c.25-2.4.45-5.4.35-9z" />
            <path className={skin} d="M-1.1 8.5c-.5 1.3-.2 2.6.9 2.9 1 .2 1.6-.6 1.4-1.7L1 8.5z" />
            {layer === 'fill' && <ForeSleeve wear={wear} />}
            {extra === 'thumb' && side === 'r' && <path className={skin} d="M-.5 10.4c-.2 1.3 0 2.3.6 2.7.5-.4.6-1.4.4-2.7z" />}
            {layer === 'fill' && extra === 'dumbbell' && (
              <g className="g-dumbbell">
                <rect x="-4" y="9" width="8" height="1.1" rx="0.5" />
                <rect x="-5" y="7.6" width="1.6" height="3.9" rx="0.5" />
                <rect x="3.4" y="7.6" width="1.6" height="3.9" rx="0.5" />
              </g>
            )}
            {layer === 'fill' && hold && (
              <g transform="translate(0 9.4)">
                <g className={`g-hold g-hold-${side}`}>
                  <HandPropShape prop={hold} />
                </g>
              </g>
            )}
          </g>
        </g>
        {layer === 'fill' && <Sleeve wear={wear} />}
      </g>
    </g>
  );
}

export function StreakGirl({ mood, kind, slot, date }: { mood: 'happy' | 'sad'; kind: GirlKind; slot: number; date?: Date }) {
  const pick = pickGirl(kind, mood, slot, date);
  const move = pick.move;
  const vars = mood === 'happy' ? happyVars(move as HappyMove) : sadVars(move as SadMove);
  const printId = `print-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const style = {
    '--ink': isLight(pick.outfit.dress) ? 'rgba(90, 40, 70, 0.35)' : 'rgba(255, 255, 255, 0.6)',
    '--dress': pick.outfit.dress,
    '--hair': pick.outfit.hair,
    '--skin': pick.outfit.skin,
    '--shoe': pick.outfit.shoe,
    '--bottom': pick.outfit.bottom,
    ...vars,
  } as CSSProperties;
  const extra = mood === 'happy' ? move.extra : undefined;
  const sit = mood === 'sad' && (move as SadMove).sit;
  const props = move.props ?? [];
  const show = (slotProps: Prop[]) => props.filter((prop) => slotProps.includes(prop)).map((prop) => <PropShape key={prop} prop={prop} />);
  const torsoProps = props.filter((prop) => ![...GROUND, ...FRONT, ...LAP, ...HEAD].includes(prop));

  return (
    <svg className={`girl ${mood}${sit ? ' sit' : ''}`} data-move={move.name} viewBox="0 0 48 72" style={style} aria-hidden="true">
      <defs>
        <PrintPattern id={printId} print={pick.print} />
      </defs>
      <PrintContext.Provider value={{ id: printId, print: pick.print }}>
        <ellipse className="g-shadow" cx="24" cy="70" rx="11" ry="1.7" />
        {show(GROUND)}
        <g className="g-all">
          {move.fx
            .filter((fx) => BEHIND.includes(fx))
            .map((fx) => (
              <Effect key={fx} fx={fx} props={props} />
            ))}
          <g className="g-idle">
            <Leg side="l" layer="line" wear={pick.wear} />
            <Leg side="r" layer="line" wear={pick.wear} />
            <Leg side="l" layer="fill" wear={pick.wear} />
            <Leg side="r" layer="fill" wear={pick.wear} />
            <g className="g-torso">
              <g className="g-head">
                <g className="g-head-loop">
                  <HairBehind hair={pick.hair} />
                </g>
              </g>
              <Clothes wear={pick.wear} />
              <Arm side="l" extra={extra} layer="line" wear={pick.wear} />
              <Arm side="r" extra={extra} layer="line" wear={pick.wear} />
              <Arm side="l" extra={extra} hold={move.hold?.l} layer="fill" wear={pick.wear} />
              <Arm side="r" extra={extra} hold={move.hold?.r} layer="fill" wear={pick.wear} />
              {torsoProps.map((prop) => (
                <PropShape key={prop} prop={prop} />
              ))}
              <g className="g-head">
                <g className="g-head-loop">
                  <Head face={move.face} hair={pick.hair} sad={mood === 'sad'} />
                  {show(HEAD)}
                </g>
              </g>
            </g>
          </g>
          {show(LAP)}
          <g className="g-fx">
            {move.fx
              .filter((fx) => !BEHIND.includes(fx))
              .map((fx) => (
                <Effect key={fx} fx={fx} props={props} />
              ))}
          </g>
        </g>
        {show(FRONT)}
      </PrintContext.Provider>
    </svg>
  );
}
