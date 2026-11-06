import type { ReactNode } from 'react';
import type { Fx, HandProp, Prop } from './moves';

const STAR = 'M0-4.5l1.3 2.7 3 .4-2.2 2.1.5 3L0 2.3l-2.6 1.4.5-3-2.2-2.1 3-.4z';

export function HandPropShape({ prop }: { prop: HandProp }): ReactNode {
  switch (prop) {
    case 'spoon':
      return (
        <g className="hp-metal">
          <line x1="0" y1="0" x2="-3.4" y2="-3.2" />
          <ellipse cx="-4.2" cy="-4" rx="1.5" ry="1" transform="rotate(-40 -4.2 -4)" />
        </g>
      );
    case 'ladle':
      return (
        <g className="hp-metal">
          <line x1="0" y1="0" x2="0" y2="7.5" />
          <ellipse cx="0" cy="8.3" rx="1.6" ry="1.1" />
        </g>
      );
    case 'fork':
      return (
        <g>
          <g className="hp-metal">
            <line x1="0" y1="0" x2="-3" y2="-3.4" />
          </g>
          <circle className="hp-green" cx="-3.6" cy="-4.4" r="1.3" />
          <circle className="hp-green" cx="-2.6" cy="-5.2" r="1" />
        </g>
      );
    case 'glass':
    case 'smoothie':
      return (
        <g>
          <rect className={prop === 'glass' ? 'hp-water' : 'hp-smoothie'} x="-1.7" y="-3.4" width="3.4" height="4.8" rx="0.5" />
          {prop === 'smoothie' && <line className="hp-straw" x1="0.6" y1="-3.4" x2="1.8" y2="-6" />}
        </g>
      );
    case 'bottle':
      return (
        <g>
          <rect className="hp-bottle" x="-1.4" y="-4.6" width="2.8" height="6.6" rx="0.9" />
          <rect className="hp-cap" x="-0.8" y="-5.8" width="1.6" height="1.3" rx="0.3" />
        </g>
      );
    case 'apple':
      return (
        <g>
          <circle className="hp-apple" cx="0" cy="-1.4" r="2.4" />
          <path className="hp-green" d="M0.2-3.6q1.6-1.4 2.6-.6-1.2 1.2-2.6.6z" />
        </g>
      );
    case 'knife':
      return (
        <g>
          <rect className="hp-handle" x="-0.6" y="-1.2" width="1.2" height="2.6" rx="0.4" />
          <path className="hp-blade" d="M-0.7 1.4h1.5l.3 5.6-1.8-1.1z" />
        </g>
      );
    case 'plate':
      return (
        <g>
          <ellipse className="hp-plate" cx="0" cy="-1" rx="4.8" ry="1.5" />
          <circle className="hp-food-a" cx="-1.6" cy="-2.1" r="1.1" />
          <circle className="hp-green" cx="1" cy="-2.3" r="1.2" />
          <circle className="hp-food-b" cx="0" cy="-1.6" r="0.9" />
        </g>
      );
    case 'trophy':
      return (
        <g className="hp-gold">
          <rect x="-2.2" y="-1.6" width="4.4" height="1.3" rx="0.4" />
          <rect x="-0.6" y="-3.4" width="1.2" height="2" />
          <path d="M-3-8.6h6v1.8a3 3 0 0 1-6 0z" />
          <path className="hp-gold-line" d="M-3-7.8h-1.4a1.6 1.6 0 0 0 1.8 2M3-7.8h1.4a1.6 1.6 0 0 1-1.8 2" />
        </g>
      );
    case 'flag':
      return (
        <g>
          <line className="hp-pole" x1="0" y1="2" x2="0" y2="-12" />
          <path className="hp-flag" d="M0-12l8 2-8 2.6z" />
        </g>
      );
    case 'balloon':
      return (
        <g className="hp-balloon">
          <path className="hp-string" d="M0 0q1.5-4 0-8" />
          <ellipse className="hp-balloon-body" cx="0" cy="-11.6" rx="3.4" ry="4.2" />
          <path className="hp-balloon-body" d="M-.6-7.5h1.2l-.6 1z" />
        </g>
      );
    case 'star':
      return (
        <g transform="translate(0 -4)">
          <path className="hp-star" d={STAR} />
        </g>
      );
    case 'phone':
      return (
        <g>
          <rect className="hp-phone" x="-1.8" y="-3.4" width="3.6" height="5.8" rx="0.8" />
          <rect className="hp-screen" x="-1.2" y="-2.8" width="2.4" height="4.2" rx="0.4" />
        </g>
      );
    case 'popper':
      return <path className="hp-popper" d="M-1.2 1h2.4l1.6-6.4h-5.6z" />;
    case 'umbrella':
      return (
        <g>
          <line className="hp-pole" x1="0" y1="1" x2="0" y2="-11" />
          <path className="hp-umbrella" d="M-9-11q9-10 18 0-2.25-1.5-4.5 0-2.25-1.5-4.5 0-2.25-1.5-4.5 0-2.25-1.5-4.5 0z" />
        </g>
      );
    case 'glove':
      return <circle className="hp-glove" cx="0" cy="0" r="2.8" />;
  }
}

export function PropShape({ prop }: { prop: Prop }): ReactNode {
  switch (prop) {
    case 'bowl':
    case 'salad':
      return (
        <g>
          {prop === 'salad' ? (
            <>
              <circle className="hp-green" cx="20.5" cy="35.6" r="2" />
              <circle className="hp-food-a" cx="24" cy="35" r="1.6" />
              <circle className="hp-green" cx="27.4" cy="35.6" r="2" />
            </>
          ) : (
            <>
              <circle className="hp-food-b" cx="21" cy="36" r="1.6" />
              <circle className="hp-rice" cx="24" cy="35.5" r="1.9" />
              <circle className="hp-food-a" cx="27" cy="36" r="1.6" />
            </>
          )}
          <path className="pr-bowl" d="M17.2 36.4h13.6a6.8 5 0 0 1-13.6 0z" />
        </g>
      );
    case 'hoop':
      return <ellipse className="pr-hoop" cx="24" cy="41" rx="12" ry="2.6" />;
    case 'medal':
      return (
        <g>
          <path className="pr-ribbon" d="M21.5 25l2.5 7 2.5-7" />
          <circle className="pr-medal" cx="24" cy="33.6" r="2.6" />
        </g>
      );
    case 'towel':
      return <path className="pr-towel" d="M19 25.6q5 4 10 0v6.4q-1 1-2 0v-4q-3 1.8-6 0v4q-1 1-2 0z" />;
    case 'tape':
      return (
        <g className="pr-tape">
          <ellipse cx="24" cy="40" rx="10.5" ry="2" />
          <path d="M33.5 40q2.4 4 0 8.5" />
        </g>
      );
    case 'barbell':
      return (
        <g className="g-pmove">
          <line className="pr-bar" x1="6" y1="10.6" x2="42" y2="10.6" />
          <rect className="pr-plate" x="6" y="6.6" width="2.4" height="8" rx="0.6" />
          <rect className="pr-plate" x="39.6" y="6.6" width="2.4" height="8" rx="0.6" />
        </g>
      );
    case 'crown':
      return (
        <g>
          <path className="pr-crown" d="M18.6 7.4l.9-4.8 2.5 3 2-4 2 4 2.5-3 .9 4.8z" />
          <circle className="pr-jewel" cx="24" cy="5.8" r="0.8" />
        </g>
      );
    case 'rope':
      return <ellipse className="pr-rope" cx="24" cy="40" rx="15" ry="31" />;
    case 'pot':
      return (
        <g>
          <rect className="pr-pot" x="14" y="46" width="20" height="9" rx="2.2" />
          <rect className="pr-pot-rim" x="12.6" y="45" width="22.8" height="2.2" rx="1.1" />
          <path className="pr-pot-handle" d="M12.8 48.5h-2M35.2 48.5h2" />
        </g>
      );
    case 'board':
      return (
        <g>
          <circle className="hp-apple" cx="17.5" cy="44.3" r="1.4" />
          <rect className="hp-green" x="27" y="43.8" width="5" height="1.6" rx="0.8" />
          <rect className="pr-board" x="13" y="45.4" width="22" height="2.6" rx="1.1" />
        </g>
      );
    case 'bike':
      return (
        <g className="pr-bike">
          <g className="pr-wheel" style={{ transformOrigin: '11px 62px' }}>
            <circle cx="11" cy="62" r="7" />
            <path d="M4 62h14M11 55v14" />
          </g>
          <g className="pr-wheel" style={{ transformOrigin: '37px 62px' }}>
            <circle cx="37" cy="62" r="7" />
            <path d="M30 62h14M37 55v14" />
          </g>
          <path className="pr-frame" d="M11 62l11-12 12 2 3 10M22 50l1-3.5M34 52l1.5-9" />
          <rect className="pr-seat" x="19.5" y="45.8" width="7" height="2" rx="1" />
        </g>
      );
    case 'mat':
      return <rect className="pr-mat" x="4" y="68.4" width="40" height="3" rx="1.5" />;
    case 'belt':
      return (
        <g>
          <rect className="pr-belt" x="5" y="68.2" width="38" height="3.4" rx="1.7" />
          <path className="pr-belt-lines" d="M8 69.9h32" />
        </g>
      );
    case 'podium':
      return (
        <g>
          <rect className="pr-podium" x="11" y="62" width="26" height="10" rx="1.6" />
          <text className="pr-podium-num" x="24" y="70">
            1
          </text>
        </g>
      );
    case 'scale':
      return (
        <g>
          <rect className="pr-scale" x="12.5" y="66.4" width="23" height="4.8" rx="2" />
          <rect className="pr-scale-screen" x="21" y="67.4" width="6" height="2" rx="0.6" />
        </g>
      );
    case 'chart':
      return (
        <g>
          <rect className="pr-chart" x="36" y="33" width="12" height="10" rx="1.2" />
          <path className="pr-chart-line" d="M38 35.5l3 2.4 2.2-1 2.8 4.2m0 0l-1.8-.2m1.8.2l.2-1.8" />
        </g>
      );
    case 'plate-lap':
      return <ellipse className="hp-plate" cx="24" cy="47" rx="6.5" ry="1.8" />;
    case 'plate-front':
      return (
        <g>
          <circle className="hp-green" cx="22" cy="45.8" r="1.5" />
          <circle className="hp-food-a" cx="25.6" cy="46" r="1.2" />
          <ellipse className="hp-plate" cx="24" cy="47" rx="7" ry="2" />
        </g>
      );
    case 'dumbbell-floor':
      return (
        <g>
          <g className="g-dumbbell">
            <rect x="33" y="68.4" width="9" height="1.2" rx="0.5" />
            <rect x="32" y="67" width="1.8" height="4" rx="0.5" />
            <rect x="41.2" y="67" width="1.8" height="4" rx="0.5" />
          </g>
          <path className="pr-web" d="M42.6 67l3-3M42.6 67l3.6-.8M42.6 67l1.4-3.6M44 65.8l.9.8" />
        </g>
      );
  }
}

const SPARK = 'M0-3L.8-.8 3 0 .8.8 0 3-.8.8-3 0-.8-.8z';
const HEART = 'M0 1.8C-3-.6-1.6-3.2 0-1.6 1.6-3.2 3-.6 0 1.8z';
const CLOUD = 'M-7 2a3.2 3.2 0 0 1 .6-6.3 4.4 4.4 0 0 1 8.2-1.2A3.6 3.6 0 0 1 7.6 2z';

function Dream({ food }: { food: 'burger' | 'pizza' | 'cake' }) {
  return (
    <g className="fx-dream">
      <circle cx="31" cy="9" r="0.9" />
      <circle cx="33.4" cy="5.6" r="1.3" />
      <g transform="translate(40 -2)">
        <path className="fx-dream-cloud" d={CLOUD} transform="scale(1.05)" />
        {food === 'burger' && (
          <g transform="translate(0 -1.5)">
            <path className="fd-bun" d="M-3.6-.4a3.6 2.6 0 0 1 7.2 0z" />
            <rect className="fd-green" x="-3.8" y="-0.4" width="7.6" height="0.8" rx="0.4" />
            <rect className="fd-patty" x="-3.6" y="0.4" width="7.2" height="1.2" rx="0.5" />
            <rect className="fd-bun" x="-3.6" y="1.6" width="7.2" height="1.1" rx="0.5" />
          </g>
        )}
        {food === 'pizza' && (
          <g transform="translate(0 -1.5)">
            <path className="fd-pizza" d="M-3.4-2.4h6.8L0 3z" />
            <circle className="fd-patty" cx="-1" cy="-1" r="0.6" />
            <circle className="fd-patty" cx="1.2" cy="-1.2" r="0.6" />
            <circle className="fd-patty" cx="0" cy="0.8" r="0.5" />
          </g>
        )}
        {food === 'cake' && (
          <g transform="translate(0 -1.5)">
            <rect className="fd-cake" x="-3.4" y="-1" width="6.8" height="3.6" rx="0.6" />
            <rect className="fd-cream" x="-3.4" y="-1.6" width="6.8" height="1.2" rx="0.6" />
            <circle className="fd-patty" cx="0" cy="-2.4" r="0.8" />
          </g>
        )}
      </g>
    </g>
  );
}

export function Effect({ fx, props }: { fx: Fx; props: Prop[] }): ReactNode {
  switch (fx) {
    case 'notes':
      return (
        <g className="fx-notes">
          <text x="34" y="12">
            ♪
          </text>
          <text x="8" y="16">
            ♫
          </text>
        </g>
      );
    case 'sparkles':
      return (
        <g className="fx-sparkles">
          {['translate(7 8)', 'translate(41 13) scale(0.8)', 'translate(40 34) scale(0.7)', 'translate(6 32) scale(0.6)'].map((at) => (
            <g key={at} transform={at}>
              <path d={SPARK} />
            </g>
          ))}
        </g>
      );
    case 'confetti':
      return (
        <g className="fx-confetti">
          {[6, 13, 20, 28, 35, 42, 17].map((x, index) => (
            <rect key={index} x={x} y="-4" width="2" height="3.2" rx="0.4" style={{ animationDelay: `${index * 0.17}s` }} />
          ))}
        </g>
      );
    case 'hearts':
      return (
        <g className="fx-hearts">
          <g transform="translate(37 14) scale(1.5)">
            <path d={HEART} />
          </g>
          <g transform="translate(10 18) scale(1.2)">
            <path d={HEART} />
          </g>
        </g>
      );
    case 'check':
      return (
        <g className="fx-check" transform="translate(38 9)">
          <circle r="4.2" />
          <path d="M-2-.1.9 2.2 2.2-2" />
        </g>
      );
    case 'glow':
      return <circle className="fx-glow" cx="24" cy="36" r="22" />;
    case 'rainbow':
      return (
        <g className="fx-rainbow">
          <path d="M2 34a22 22 0 0 1 44 0" stroke="#ff6b6b" />
          <path d="M5 34a19 19 0 0 1 38 0" stroke="#ffc83d" />
          <path d="M8 34a16 16 0 0 1 32 0" stroke="#7ccf6b" />
          <path d="M11 34a13 13 0 0 1 26 0" stroke="#4cc9f0" />
        </g>
      );
    case 'sigh':
      return (
        <g className="fx-sigh">
          <circle cx="27" cy="19.6" r="1.4" />
          <circle cx="27" cy="19.6" r="1.1" />
        </g>
      );
    case 'rain':
    case 'storm':
      return (
        <g className={fx === 'storm' ? 'fx-cloud storm' : 'fx-cloud'} transform="translate(24 0)">
          <path d={CLOUD} />
          {fx === 'storm' && <path className="fx-bolt" d="M.5 2.6-1.6 6.4h2l-1.4 3.8 3.6-4.8H.5l1.3-2.8z" />}
          <g className="fx-drops">
            <line x1="-5" y1="4" x2="-5.6" y2="6.4" />
            <line x1="0" y1="4" x2="-0.6" y2="6.4" />
            <line x1="5" y1="4" x2="4.4" y2="6.4" />
          </g>
        </g>
      );
    case 'tear':
    case 'tears':
      return (
        <g className="fx-tears">
          <path d="M21.2 17c.9 1.4 1.2 2 1.2 2.6a1.2 1.2 0 0 1-2.4 0c0-.6.3-1.2 1.2-2.6z" />
          {fx === 'tears' && <path d="M26.8 17c.9 1.4 1.2 2 1.2 2.6a1.2 1.2 0 0 1-2.4 0c0-.6.3-1.2 1.2-2.6z" />}
        </g>
      );
    case 'dots':
      return (
        <g className="fx-dots" transform="translate(36 2)">
          <rect x="-7" y="-4" width="14" height="8" rx="4" />
          <circle cx="-3.2" cy="0" r="1" />
          <circle cx="0" cy="0" r="1" />
          <circle cx="3.2" cy="0" r="1" />
        </g>
      );
    case 'zzz':
      return (
        <g className="fx-zzz">
          <text x="32" y="10">
            z
          </text>
          <text x="36" y="5">
            z
          </text>
          <text x="40" y="0">
            Z
          </text>
        </g>
      );
    case 'smoke':
    case 'burnt':
      return (
        <g className={fx === 'burnt' ? 'fx-smoke-girl burnt' : 'fx-smoke-girl'}>
          {(fx === 'burnt' ? [20, 24, 28] : [3, 5, 2]).map((x, index) => (
            <circle key={index} cx={x} cy={fx === 'burnt' ? 44 : 24} r={fx === 'burnt' ? 2.2 : 1.6 + index * 0.2} />
          ))}
        </g>
      );
    case 'question':
      return (
        <g className="fx-question">
          <text x="35" y="8">
            ?
          </text>
        </g>
      );
    case 'sweat':
      return <path className="fx-sweat" d="M31.6 8c.8 1.3 1.1 1.9 1.1 2.4a1.1 1.1 0 0 1-2.2 0c0-.5.3-1.1 1.1-2.4z" />;
    case 'pebble':
      return <circle className="fx-pebble" cx="31" cy="68.6" r="1.3" />;
    case 'dust':
      return (
        <g className="fx-dust">
          <circle cx="17" cy="68.5" r="1.6" />
          <circle cx="31" cy="68.5" r="1.6" />
        </g>
      );
    case 'puff':
      return (
        <g transform="translate(37 10) scale(0.55)">
          <path className="fx-puff" d={CLOUD} />
        </g>
      );
    case 'steam': {
      const y = props.includes('pot') ? 44 : 34;
      return (
        <g className="fx-steam">
          {[20, 24, 28].map((x) => (
            <path key={x} d={`M${x} ${y}q-1.4-2 0-4t0-4`} />
          ))}
        </g>
      );
    }
    case 'footprints':
      return (
        <g className="fx-footprints">
          <ellipse cx="9" cy="70.4" rx="1.6" ry="0.8" />
          <ellipse cx="39" cy="70.4" rx="1.6" ry="0.8" />
        </g>
      );
    case 'speed':
      return (
        <g className="fx-speed">
          <path d="M2 30h7M0 38h8M3 46h6" />
        </g>
      );
    case 'fireworks':
      return (
        <g className="fx-fireworks">
          {[
            [8, 6, '#ff5c8a'],
            [40, 2, '#ffc83d'],
            [42, 26, '#4cc9f0'],
          ].map(([x, y, color], index) => (
            <g key={index} transform={`translate(${x} ${y})`}>
              <g
                className="fx-burst"
                style={{
                  stroke: String(color),
                  animationDelay: `${index * 0.45}s`,
                }}
              >
                <path d="M0-4v-2M0 4v2M-4 0h-2M4 0h2M2.8-2.8l1.4-1.4M-2.8 2.8l-1.4 1.4M2.8 2.8l1.4 1.4M-2.8-2.8l-1.4-1.4" />
              </g>
            </g>
          ))}
        </g>
      );
    case 'leaves':
      return (
        <g className="fx-leaves">
          {[19, 24, 29].map((x, index) => (
            <ellipse key={x} cx={x} cy={props.includes('board') ? 43 : 33} rx="1.3" ry="0.7" style={{ animationDelay: `${index * 0.2}s` }} />
          ))}
        </g>
      );
    case 'roti':
      return <ellipse className="fx-roti" cx="24" cy="34" rx="4" ry="1.4" />;
    case 'dream-burger':
      return <Dream food="burger" />;
    case 'dream-pizza':
      return <Dream food="pizza" />;
    case 'dream-cake':
      return <Dream food="cake" />;
    case 'growl':
      return (
        <g className="fx-growl">
          <path d="M33 38q1-1 2 0t2 0M33 42q1-1 2 0t2 0" />
        </g>
      );
    case 'splash':
      return (
        <g className="fx-splash">
          {[
            [10, 12],
            [38, 10],
            [36, 22],
            [12, 24],
          ].map(([x, y], index) => (
            <path key={index} d={`M${x} ${y}c.8 1.3 1.1 1.9 1.1 2.4a1.1 1.1 0 0 1-2.2 0c0-.5.3-1.1 1.1-2.4z`} style={{ animationDelay: `${index * 0.3}s` }} />
          ))}
        </g>
      );
  }
}
