import { createContext, useContext } from 'react';
import type { Print, Wear } from './moves';

type Layer = 'line' | 'fill';

const HIP = { l: 21.5, r: 26.5 };

const THIGH_SKIN = 'M-1.9 0c-.2 4 .1 6.8.45 9h2.9c.35-2.2.65-5 .45-9z';
const SHIN_SKIN = 'M-1.45 0c-.45 2.4-.25 4.6.15 6 .3 1.4.4 2.8.4 4h1.8c0-1.2.1-2.6.4-4 .4-1.4.6-3.6.15-6z';
const THIGH_LOOSE = 'M-2.3 0c-.2 4 0 6.8.4 9.2h3.8c.4-2.4.6-5.2.4-9.2z';
const SHIN_LOOSE = 'M-1.9 0c-.3 3-.2 6 .1 9.2h3.6c.3-3.2.4-6.2.1-9.2z';
const SHORTS = 'M-2.5-.6c-.2 2.4 0 4.3.3 5.8h4.4c.3-1.5.5-3.4.3-5.8z';
const FLAT = 'M1 9.3c.1 1.4-.5 2.4-2.2 2.5-1.5.1-2.4-.4-2.2-1.1.2-.8 1.4-1.1 2.3-1.6z';
const SNEAKER = 'M1.5 8.9c.3 1.7-.3 3-2.5 3.1-1.9.1-2.9-.4-2.7-1.4.2-.9 1.7-1.3 2.7-1.9z';

const TEE = 'M20.6 24.2c1.9 1.4 4.9 1.4 6.8 0l2.2 1.6c1 .8.8 2.4-.2 3.8l-.6 10.6h-9.6l-.6-10.6c-1-1.4-1.2-3-.2-3.8z';
const TANK = 'M21.2 24.4c1.6 1.2 4 1.2 5.6 0l1.6.3c.5 1.6.6 3.4 0 5l-.4 10.2h-8l-.4-10.2c-.6-1.6-.5-3.4 0-5z';
const HIPS = 'M19.2 38.4h9.6l1.1 8.6c-3.8 1-8 1-11.8 0z';
const NECK = 'M20.9 24.5c1.8 1.3 4.4 1.3 6.2 0';

type LegSpec = {
  cover: 'skin' | 'tight' | 'loose' | 'shorts';
  suit?: boolean;
  stripe?: boolean;
  cuff?: boolean;
  sneaker: boolean;
};

const LEGS: Record<Wear, LegSpec> = {
  dress: { cover: 'skin', sneaker: false },
  frock: { cover: 'skin', sneaker: false },
  'skirt-top': { cover: 'skin', sneaker: false },
  kurti: { cover: 'tight', sneaker: false },
  jumpsuit: { cover: 'loose', suit: true, sneaker: false },
  dungaree: { cover: 'shorts', sneaker: true },
  'tee-pants': { cover: 'loose', stripe: true, cuff: true, sneaker: true },
  'tee-shorts': { cover: 'shorts', sneaker: true },
  'tank-leggings': { cover: 'tight', sneaker: true },
  'tank-shorts': { cover: 'shorts', sneaker: true },
  'hoodie-joggers': { cover: 'loose', cuff: true, sneaker: true },
};

export const PrintContext = createContext<{ id: string; print: Print }>({
  id: '',
  print: 'plain',
});

function Cloth({ className, d }: { className: string; d: string }) {
  const { id, print } = useContext(PrintContext);
  return (
    <>
      <path className={className} d={d} />
      {print !== 'plain' && <path className="g-print" d={d} fill={`url(#${id})`} />}
    </>
  );
}

export function PrintPattern({ id, print }: { id: string; print: Print }) {
  if (print === 'plain') return null;
  const tile = { dots: 2.2, stripes: 1.6, check: 2.4, floral: 4, hearts: 3.2 }[print];
  return (
    <pattern id={id} width={tile} height={tile} patternUnits="userSpaceOnUse">
      {print === 'dots' && (
        <>
          <circle className="g-ink" cx="0.6" cy="0.6" r="0.36" />
          <circle className="g-ink" cx="1.7" cy="1.7" r="0.36" />
        </>
      )}
      {print === 'stripes' && <rect className="g-ink" x="0" y="0" width="1.6" height="0.55" />}
      {print === 'check' && (
        <>
          <rect className="g-ink soft" x="0" y="0" width="2.4" height="0.8" />
          <rect className="g-ink soft" x="0" y="0" width="0.8" height="2.4" />
        </>
      )}
      {print === 'floral' && (
        <>
          {[
            [1, 1],
            [3, 3],
          ].map(([x, y]) => (
            <g key={x}>
              <circle className="g-ink" cx={x - 0.42} cy={y} r="0.33" />
              <circle className="g-ink" cx={x + 0.42} cy={y} r="0.33" />
              <circle className="g-ink" cx={x} cy={y - 0.42} r="0.33" />
              <circle className="g-ink" cx={x} cy={y + 0.42} r="0.33" />
              <circle className="g-ink-center" cx={x} cy={y} r="0.24" />
            </g>
          ))}
        </>
      )}
      {print === 'hearts' && <path className="g-ink" d="M1.6 2.1c-1-.6-.85-1.4-.4-1.4.2 0 .35.12.4.3.05-.18.2-.3.4-.3.45 0 .6.8-.4 1.4z" />}
    </pattern>
  );
}

export function Leg({ side, layer, wear }: { side: 'l' | 'r'; layer: Layer; wear: Wear }) {
  const spec = LEGS[wear];
  const loose = spec.cover === 'loose';
  const covered = loose || spec.cover === 'tight';
  const line = layer === 'line';
  const cloth = spec.suit ? 'g-suit' : 'g-pants';
  const thighClass = line ? 'g-skin-line' : covered ? cloth : 'g-skin';
  const outer = side === 'l' ? -1 : 1;
  return (
    <g transform={`translate(${HIP[side]} 46)`}>
      <g className={side === 'r' ? 'g-kick' : undefined}>
        <g className={`g-thigh g-thigh-${side}`}>
          <path className={thighClass} d={loose ? THIGH_LOOSE : THIGH_SKIN} />
          {spec.cover === 'shorts' && <path className={line ? 'g-skin-line' : 'g-pants'} d={SHORTS} />}
          {!line && spec.stripe && <path className="g-stripe" d={`M${outer * 1.7} 0.4l${outer * 0.1} 8.6`} />}
          <g transform="translate(0 9)">
            <g className={`g-shin g-shin-${side}`}>
              <circle className={thighClass} cx="0" cy="0" r={loose ? 1.9 : 1.45} />
              <path className={thighClass} d={loose ? SHIN_LOOSE : SHIN_SKIN} />
              {!line && spec.stripe && <path className="g-stripe" d={`M${outer * 1.6} 0l${outer * 0.05} 8.4`} />}
              {!line && spec.cuff && <rect className="g-cuff" x="-1.8" y="8.4" width="3.6" height="1.3" rx="0.6" />}
              {!line && <path className={spec.sneaker ? 'g-shoe sneaker' : 'g-shoe'} transform={side === 'r' ? 'scale(-1 1)' : undefined} d={spec.sneaker ? SNEAKER : FLAT} />}
            </g>
          </g>
        </g>
      </g>
    </g>
  );
}

export function Sleeve({ wear }: { wear: Wear }) {
  switch (wear) {
    case 'tank-leggings':
    case 'tank-shorts':
    case 'frock':
      return null;
    case 'kurti':
      return (
        <>
          <Cloth className="g-sleeve" d="M-2.2-.6c-.3 3-.1 6 .3 8.9h3.8c.4-2.9.6-5.9.3-8.9-1.4-1.3-3-1.3-4.4 0z" />
          <path className="g-trim" d="M-1.9 7.9h3.8" />
        </>
      );
    case 'dress':
      return <Cloth className="g-sleeve" d="M-2.4-.6c-.4 2.2-.2 3.8.4 4.8q2 .9 4 0c.6-1 .8-2.6.4-4.8-1.4-1.4-3.4-1.4-4.8 0z" />;
    case 'hoodie-joggers':
      return <path className="g-sleeve" d="M-2.3-.6c-.3 3.2-.1 6.2.2 9.2h4.2c.3-3 .5-6 .2-9.2-1.4-1.3-3.2-1.3-4.6 0z" />;
    default:
      return <Cloth className="g-sleeve" d="M-2.3-.6c-.3 2.4-.2 4 .1 5.2h4.4c.3-1.2.4-2.8.1-5.2-1.4-1.3-3.2-1.3-4.6 0z" />;
  }
}

export function ForeSleeve({ wear }: { wear: Wear }) {
  if (wear !== 'hoodie-joggers') return null;
  return (
    <>
      <circle className="g-sleeve" cx="0" cy="0" r="1.9" />
      <path className="g-sleeve" d="M-1.9 0c-.2 3 0 5.6.3 7.6h3.2c.3-2 .5-4.6.3-7.6z" />
      <rect className="g-cuff-top" x="-1.65" y="7" width="3.3" height="1.3" rx="0.6" />
    </>
  );
}

export function Clothes({ wear }: { wear: Wear }) {
  switch (wear) {
    case 'dress':
      return (
        <>
          <Cloth className="g-skirt" d="M20.2 35.2h7.6c2.2 3.8 5.2 8.8 7.2 14-6 2-16 2-22 0 2-5.2 5-10.2 7.2-14z" />
          <path className="g-skirt-fold" d="M22 37.6q-1 6-2.6 12.2M26 37.6q1 6 2.6 12.2M24 37.4v13" />
          <Cloth className="g-bodice" d="M20.6 24.2c1.9 1.4 4.9 1.4 6.8 0l2.2 1.6c1 .8.8 2.4-.2 3.8l-1.6 6h-7.6l-1.6-6c-1-1.4-1.2-3-.2-3.8z" />
          <path className="g-neckline" d={NECK} />
          <rect className="g-waist" x="20" y="34.6" width="8" height="1.7" rx="0.85" />
        </>
      );
    case 'frock':
      return (
        <>
          <Cloth className="g-skirt" d="M20.4 35h7.2c2 3 4.4 7 5.6 11.4-5 1.8-13.4 1.8-18.4 0 1.2-4.4 3.6-8.4 5.6-11.4z" />
          <path className="g-skirt-fold" d="M22.2 37.4q-.9 4.6-2.2 9.6M25.8 37.4q.9 4.6 2.2 9.6" />
          <path className="g-hem" d="M14.9 46.1c5.2 1.6 13 1.6 18.2 0" />
          <Cloth className="g-bodice" d="M21 24.3c1.7 1.3 4.3 1.3 6 0l1.6.4c.6 1.6.7 3.4.1 5l-.9 5.5h-7.6l-.9-5.5c-.6-1.6-.5-3.4.1-5z" />
          <path className="g-neckline" d="M21.2 24.6c1.6 1.2 4 1.2 5.6 0" />
          <rect className="g-sash" x="19.9" y="34.3" width="8.2" height="1.8" rx="0.9" />
          <path className="g-sash" d="M24 35.2l-2.2-1.4v2.8zM24 35.2l2.2-1.4v2.8zM23.6 35.6l-1 3 1-.4zM24.4 35.6l1 3-1-.4z" />
        </>
      );
    case 'kurti':
      return (
        <>
          <Cloth
            className="g-bodice"
            d="M20.6 24.2c1.9 1.4 4.9 1.4 6.8 0l2.2 1.6c1 .8.8 2.4-.2 3.8l-.3 6.2c1.6 4.8 2.6 10.2 3 16.2-5.6 1.2-12.6 1.2-18.2 0 .4-6 1.4-11.4 3-16.2l-.3-6.2c-1-1.4-1.2-3-.2-3.8z"
          />
          <path className="g-trim" d={`M15.3 50.4c5.6 1.1 11.8 1.1 17.4 0${NECK}`} />
          <path className="g-skirt-fold" d="M24 27v24.6M21.4 37q-1.4 6-2.2 14M26.6 37q1.4 6 2.2 14" />
          <circle className="g-bead" cx="24" cy="27.4" r="0.45" />
          <circle className="g-bead" cx="24" cy="29" r="0.45" />
          <circle className="g-bead" cx="24" cy="30.6" r="0.45" />
        </>
      );
    case 'skirt-top':
      return (
        <>
          <path className="g-skirt alt" d="M20 36.6h8c1.8 3.4 3.8 7.4 4.8 11.4-5 1.6-12.6 1.6-17.6 0 1-4 3-8 4.8-11.4z" />
          <path className="g-skirt-fold alt" d="M22 38.6l-1.6 9.6M26 38.6l1.6 9.6M24 38.6v10" />
          <Cloth className="g-bodice" d="M20.6 24.2c1.9 1.4 4.9 1.4 6.8 0l2.2 1.6c1 .8.8 2.4-.2 3.8l-.6 7.4h-9.6l-.6-7.4c-1-1.4-1.2-3-.2-3.8z" />
          <path className="g-neckline" d={NECK} />
          <rect className="g-belt" x="19.8" y="36" width="8.4" height="1.4" rx="0.7" />
          <rect className="g-buckle" x="23.2" y="35.9" width="1.6" height="1.6" rx="0.3" />
        </>
      );
    case 'jumpsuit':
      return (
        <>
          <path className="g-suit" d={HIPS} />
          <path className="g-bodice" d={TANK} />
          <path className="g-neckline" d="M21.4 24.7c1.6 1.1 3.6 1.1 5.2 0" />
          <path className="g-skirt-fold" d="M24 30.5v7" />
          <rect className="g-waist" x="19.6" y="37.4" width="8.8" height="1.6" rx="0.8" />
          <circle className="g-button" cx="24" cy="31.6" r="0.4" />
          <circle className="g-button" cx="24" cy="34.2" r="0.4" />
        </>
      );
    case 'dungaree':
      return (
        <>
          <path className="g-pants" d={HIPS} />
          <Cloth className="g-bodice" d={TEE} />
          <path className="g-neckline" d={NECK} />
          <path className="g-pants" d="M20.8 31h6.4l.4 8h-7.2z" />
          <path className="g-strap" d="M21.2 31.4l-.9-6.2M26.8 31.4l.9-6.2" />
          <circle className="g-button light" cx="21.5" cy="31.8" r="0.45" />
          <circle className="g-button light" cx="26.5" cy="31.8" r="0.45" />
          <path className="g-pocket" d="M22.4 33h3.2v2.2q-1.6.8-3.2 0z" />
        </>
      );
    case 'tank-leggings':
    case 'tank-shorts':
      return (
        <>
          <path className="g-pants" d="M19.4 38.5h9.2l1 8.6c-3.6 1-7.6 1-11.2 0z" />
          <Cloth className="g-bodice" d={TANK} />
          <path className="g-stripe wide" d="M19.9 33.2h8.2" />
          <path className="g-neckline" d="M21.4 24.7c1.6 1.1 3.6 1.1 5.2 0" />
        </>
      );
    case 'hoodie-joggers':
      return (
        <>
          <path className="g-pants" d={HIPS} />
          <path className="g-bodice" d="M20.4 24.1c1.9 1.5 5.3 1.5 7.2 0l2.4 1.7c1 .8.9 2.4-.1 3.8l-.5 10.8h-10.8l-.5-10.8c-1-1.4-1.1-3-.1-3.8z" />
          <rect className="g-cuff-top" x="18.8" y="39" width="10.4" height="1.8" rx="0.8" />
          <path className="g-hood" d="M19.6 24.6c1.4-2.1 7.4-2.1 8.8 0-1.6 2-7.2 2-8.8 0z" />
          <path className="g-string" d="M23 25.8l-.2 3.6M25 25.8l.2 3.6" />
          <path className="g-pocket" d="M21.2 34.6h5.6l.9 3.6h-7.4z" />
        </>
      );
    default:
      return (
        <>
          <path className="g-pants" d={HIPS} />
          <Cloth className="g-bodice" d={TEE} />
          <path className="g-neckline" d={NECK} />
          <path className="g-logo" d="M24 32.4c-1.6-1-1.2-2.4-.4-2.4.3 0 .4.2.4.4 0-.2.1-.4.4-.4.8 0 1.2 1.4-.4 2.4z" />
        </>
      );
  }
}
