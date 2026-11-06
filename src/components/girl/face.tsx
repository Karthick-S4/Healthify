import type { Face, Hair } from './moves';

const EYE_Y = 16.4;
const LEFT = 21.4;
const RIGHT = 26.6;

function OpenEye({ x, look = 0, big = false, droop = false }: { x: number; look?: number; big?: boolean; droop?: boolean }) {
  const outer = x < 24 ? -1 : 1;
  const rx = big ? 1.45 : 1.25;
  return (
    <g>
      <ellipse className="g-eye-white" cx={x} cy={EYE_Y} rx={rx} ry={big ? 1.7 : 1.45} />
      <circle className="g-iris" cx={x + 0.1} cy={EYE_Y + 0.2 + look} r={big ? 1.1 : 0.95} />
      <circle className="g-pupil" cx={x + 0.1} cy={EYE_Y + 0.2 + look} r="0.45" />
      <circle className="g-shine" cx={x + 0.5} cy={EYE_Y - 0.3 + look} r="0.36" />
      {droop && <path className="g-lid" d={`M${x - rx - 0.1} ${EYE_Y - 0.4}q${rx + 0.1}-1.5 ${2 * rx + 0.2} 0v.6q-${rx + 0.1}-.5-${2 * rx + 0.2} 0z`} />}
      <path className="g-lash" d={`M${x - rx - 0.1} ${EYE_Y - 0.3}q${rx + 0.1}-${droop ? 0.9 : 1.6} ${2 * rx + 0.2} 0`} />
      <path className="g-lash" d={`M${x + outer * (rx + 0.05)} ${EYE_Y - 0.4}l${outer * 0.7}-0.5`} />
    </g>
  );
}

function HappyEye({ x }: { x: number }) {
  const outer = x < 24 ? -1 : 1;
  return <path className="g-lash" d={`M${x - 1.4} ${EYE_Y + 0.5}q1.4-1.7 2.8 0M${x + outer * 1.4} ${EYE_Y + 0.4}l${outer * 0.6}-0.4`} />;
}

function ClosedEye({ x }: { x: number }) {
  return <path className="g-lash" d={`M${x - 1.4} ${EYE_Y}q1.4 1.4 2.8 0M${x - 0.8} ${EYE_Y + 0.9}l-.3.6M${x} ${EYE_Y + 1.1}v.6M${x + 0.8} ${EYE_Y + 0.9}l.3.6`} />;
}

function HeartEye({ x }: { x: number }) {
  return <path className="g-heart-eye" d={`M${x} ${EYE_Y + 1.2}c-2.2-1.3-1.9-3-.9-3 .5 0 .8.3.9.7.1-.4.4-.7.9-.7 1 0 1.3 1.7-.9 3z`} />;
}

function StarEye({ x }: { x: number }) {
  return <path className="g-star-eye" d={`M${x} ${EYE_Y - 1.5}l.45 1 1.1.1-.85.75.27 1.1-.97-.6-.97.6.27-1.1-.85-.75 1.1-.1z`} />;
}

function SquintEye({ x }: { x: number }) {
  const outer = x < 24 ? -1 : 1;
  return <path className="g-lash" d={`M${x + outer * 1.2} ${EYE_Y - 0.9}l${-outer * 2.2} .9 ${outer * 2.2} .9`} />;
}

const OPEN_SMILE = (
  <>
    <path className="g-mouth" d="M21.8 19.3h4.4q-.2 3-2.2 3t-2.2-3z" />
    <path className="g-tongue" d="M22.9 21.5q1.1-.9 2.2 0-.4.8-1.1.8t-1.1-.8z" />
  </>
);

function Brows({ mood }: { mood: 'soft' | 'sad' | 'cross' | 'up' | 'flat' }) {
  const d = {
    soft: 'M20 14.1q1.4-.9 2.9-.3M28 14.1q-1.4-.9-2.9-.3',
    sad: 'M20.1 14.2l2.7-.9M27.9 14.2l-2.7-.9',
    cross: 'M20.1 13.3l2.7.9M27.9 13.3l-2.7.9',
    up: 'M20 13.4q1.4-1 2.9-.4M28 13.4q-1.4-1-2.9-.4',
    flat: 'M20.1 14h2.8M27.9 14h-2.8',
  }[mood];
  return <path className="g-brow" d={d} />;
}

function Blush({ strong = false }: { strong?: boolean }) {
  return (
    <>
      <ellipse className={strong ? 'g-blush puffed' : 'g-blush'} cx="20.2" cy="18.8" rx={strong ? 1.6 : 1.2} ry={strong ? 1 : 0.7} />
      <ellipse className={strong ? 'g-blush puffed' : 'g-blush'} cx="27.8" cy="18.8" rx={strong ? 1.6 : 1.2} ry={strong ? 1 : 0.7} />
    </>
  );
}

const MOUTH = {
  smile: <path className="g-lip" d="M22.2 19.9q1.8 1.6 3.6 0" />,
  sad: <path className="g-lip" d="M22.4 20.9q1.6-1.3 3.2 0" />,
  flat: <path className="g-lip" d="M23 20.3h2" />,
  wave: <path className="g-lip" d="M22.4 20.4q.6-.6 1.2 0t1.2 0 1.2 0" />,
  soft: <path className="g-lip" d="M23 20.2q1 .6 2 0" />,
};

export function FaceShape({ face }: { face: Face | 'neutral' }) {
  switch (face) {
    case 'smile':
      return (
        <>
          <Brows mood="soft" />
          <HappyEye x={LEFT} />
          <HappyEye x={RIGHT} />
          {MOUTH.smile}
          <Blush />
        </>
      );
    case 'grin':
      return (
        <>
          <Brows mood="up" />
          <HappyEye x={LEFT} />
          <HappyEye x={RIGHT} />
          <path className="g-mouth" d="M22 19.4h4q0 2.7-2 2.7t-2-2.7z" />
          <path className="g-teeth" d="M22.3 19.5h3.4v.6h-3.4z" />
          <Blush />
        </>
      );
    case 'wink':
      return (
        <>
          <Brows mood="soft" />
          <OpenEye x={LEFT} />
          <HappyEye x={RIGHT} />
          {MOUTH.smile}
          <Blush />
        </>
      );
    case 'calm':
      return (
        <>
          <Brows mood="soft" />
          <ClosedEye x={LEFT} />
          <ClosedEye x={RIGHT} />
          {MOUTH.soft}
          <Blush />
        </>
      );
    case 'yum':
      return (
        <>
          <Brows mood="up" />
          <HappyEye x={LEFT} />
          <HappyEye x={RIGHT} />
          <ellipse className="g-mouth chew" cx="24" cy="20.3" rx="1.2" ry="0.9" />
          <Blush strong />
        </>
      );
    case 'wow':
      return (
        <>
          <Brows mood="up" />
          <OpenEye x={LEFT} big />
          <OpenEye x={RIGHT} big />
          <ellipse className="g-mouth" cx="24" cy="20.5" rx="0.8" ry="1" />
          <Blush />
        </>
      );
    case 'tired':
      return (
        <>
          <Brows mood="sad" />
          <path className="g-lash" d="M20.3 15.6l1.8 1-1.8 1M27.7 15.6l-1.8 1 1.8 1" />
          {MOUTH.wave}
        </>
      );
    case 'neutral':
      return (
        <>
          <Brows mood="soft" />
          <OpenEye x={LEFT} />
          <OpenEye x={RIGHT} />
          {MOUTH.flat}
        </>
      );
    case 'sad':
    case 'cry':
      return (
        <>
          <Brows mood="sad" />
          <OpenEye x={LEFT} look={0.35} droop />
          <OpenEye x={RIGHT} look={0.35} droop />
          {MOUTH.sad}
          {face === 'cry' && <path className="g-stream" d="M21.4 17.9v3.2M26.6 17.9v3.2" />}
        </>
      );
    case 'pout':
      return (
        <>
          <Brows mood="cross" />
          <OpenEye x={LEFT} droop />
          <OpenEye x={RIGHT} droop />
          <path className="g-mouth pout" d="M23.1 20.4q.9-.7 1.8 0-.9.7-1.8 0z" />
          <Blush strong />
        </>
      );
    case 'sleepy':
      return (
        <>
          <Brows mood="soft" />
          <ClosedEye x={LEFT} />
          <ClosedEye x={RIGHT} />
          {MOUTH.soft}
        </>
      );
    case 'love':
      return (
        <>
          <Brows mood="up" />
          <HeartEye x={LEFT} />
          <HeartEye x={RIGHT} />
          {OPEN_SMILE}
          <Blush strong />
        </>
      );
    case 'laugh':
      return (
        <>
          <Brows mood="up" />
          <SquintEye x={LEFT} />
          <SquintEye x={RIGHT} />
          <path className="g-mouth" d="M21.4 19.1h5.2q-.2 3.6-2.6 3.6t-2.6-3.6z" />
          <path className="g-teeth" d="M21.7 19.2h4.6v.6h-4.6z" />
          <path className="g-tongue" d="M22.7 21.8q1.3-1 2.6 0-.5.8-1.3.8t-1.3-.8z" />
          <Blush strong />
        </>
      );
    case 'proud':
      return (
        <>
          <Brows mood="up" />
          <HappyEye x={LEFT} />
          <HappyEye x={RIGHT} />
          <path className="g-lip" d="M22.4 20q1.9 1.3 3.8-.5" />
          <Blush />
        </>
      );
    case 'shy':
      return (
        <>
          <Brows mood="sad" />
          <OpenEye x={LEFT} look={0.4} />
          <OpenEye x={RIGHT} look={0.4} />
          {MOUTH.soft}
          <Blush strong />
          <path className="g-shy" d="M19.4 18.4l.5.7M20.4 18.3l.5.7M27.1 18.3l.5.7M28.1 18.4l.5.7" />
        </>
      );
    case 'starry':
      return (
        <>
          <Brows mood="up" />
          <StarEye x={LEFT} />
          <StarEye x={RIGHT} />
          {OPEN_SMILE}
          <Blush />
        </>
      );
    case 'excited':
      return (
        <>
          <Brows mood="up" />
          <OpenEye x={LEFT} big />
          <OpenEye x={RIGHT} big />
          {OPEN_SMILE}
          <Blush strong />
        </>
      );
    case 'worried':
      return (
        <>
          <Brows mood="sad" />
          <OpenEye x={LEFT} big />
          <OpenEye x={RIGHT} big />
          {MOUTH.wave}
          <path className="g-drop" d="M29.6 11.6q.9 1.3.9 1.9a.9.9 0 0 1-1.8 0q0-.6.9-1.9z" />
        </>
      );
    case 'grumpy':
      return (
        <>
          <Brows mood="cross" />
          <OpenEye x={LEFT} look={0.2} droop />
          <OpenEye x={RIGHT} look={0.2} droop />
          <path className="g-lip" d="M22.6 21q1.4-.9 2.8 0" />
        </>
      );
    case 'bored':
      return (
        <>
          <Brows mood="flat" />
          <OpenEye x={LEFT} look={0.25} droop />
          <OpenEye x={RIGHT} look={0.25} droop />
          <path className="g-lip" d="M22.8 20.5h2.4" />
        </>
      );
    case 'sob':
      return (
        <>
          <Brows mood="sad" />
          <SquintEye x={LEFT} />
          <SquintEye x={RIGHT} />
          <path className="g-mouth" d="M22 21.9q2-3 4 0-2 .5-4 0z" />
          <path className="g-stream" d="M21 17.4v3.8M27 17.4v3.8" />
        </>
      );
  }
}

export function Head({ face, hair, sad }: { face: Face; hair: Hair; sad: boolean }) {
  return (
    <>
      <path className="g-neck" d="M22.5 20.5h3v4.6q-1.5.9-3 0z" />
      <path className="g-hair" d="M16.9 16c-.5-7 2.7-10.2 7.1-10.2s7.6 3.2 7.1 10.2c-.1 2.6-.9 4.4-1.9 5.4H18.8c-1-1-1.8-2.8-1.9-5.4z" />
      {hair === 'bun' && (
        <>
          <circle className="g-hair" cx="24" cy="5.3" r="3.2" />
          <ellipse className="g-hair-tie" cx="24" cy="7.7" rx="1.9" ry="0.55" />
        </>
      )}
      <ellipse className="g-skin" cx="17.7" cy="16.9" rx="0.9" ry="1.3" />
      <ellipse className="g-skin" cx="30.3" cy="16.9" rx="0.9" ry="1.3" />
      <path className="g-face" d="M17.6 15.6c0-4.6 2.8-7 6.4-7s6.4 2.4 6.4 7c0 4-2.8 7-6.4 7s-6.4-3-6.4-7z" />
      <path className="g-nose" d="M24.3 17.9q.6.8-.4 1" />
      {sad ? (
        <>
          <g className="f-start">
            <FaceShape face="neutral" />
          </g>
          <g className="f-main">
            <FaceShape face={face} />
          </g>
        </>
      ) : (
        <FaceShape face={face} />
      )}
      <path className="g-hair" d="M17.3 15.6c-.4-5.8 2.9-8.5 7-8.5 4.2 0 7 2.9 6.5 7.9-.8-2.4-2.2-3.8-4.4-4.3-1.4 1.9-4 3.1-7.1 3.2-.9.5-1.5 1-2 1.7zM17.3 15c-.3 2.5.1 4.5.9 5.6 0-2.1.2-4 .7-5.6z" />
      <path className="g-hair-shine" d="M20.6 9.6q2.6-1.4 5.6-.6" />
    </>
  );
}

export function HairBehind({ hair }: { hair: Hair }) {
  if (hair === 'ponytail') {
    return (
      <>
        <path className="g-hair" d="M29.4 8.8c5.2.6 6.1 7.2 4.5 13.2-.6 3-2 5-3.2 6 .8-4 .8-9-1.2-15z" />
        <circle className="g-hair-tie" cx="30.1" cy="9.8" r="0.95" />
      </>
    );
  }
  if (hair === 'long') return <path className="g-hair" d="M17 13c-1.8 7-1.4 16 .6 21 1.6-.6 2.4-4 2.8-9h7.2c.4 5 1.2 8.4 2.8 9 2-5 2.4-14 .6-21z" />;
  return null;
}
