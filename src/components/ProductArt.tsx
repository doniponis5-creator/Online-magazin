import type { ArtKind } from '@/data/products'

/**
 * Оригинальные схематичные SVG-иллюстрации товаров (не фото).
 * Стилистически единые, масштабируемые, в палитре бренда.
 * Заменяются реальными фотографиями после интеграции контента.
 */
export function ProductArt({
  kind,
  color = '#245BEB',
  className,
}: {
  kind: ArtKind
  color?: string
  className?: string
}) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true" focusable="false">
      <ellipse cx="100" cy="180" rx="46" ry="7" fill="#142334" opacity="0.08" />
      {kind === 'phone' && <PhoneArt color={color} />}
      {kind === 'laptop' && <LaptopArt color={color} />}
      {kind === 'tablet' && <TabletArt color={color} />}
      {kind === 'tv' && <TvArt color={color} />}
      {kind === 'headphones' && <HeadphonesArt color={color} />}
      {kind === 'washer' && <WasherArt color={color} />}
      {kind === 'coffee' && <CoffeeArt color={color} />}
      {kind === 'fryer' && <FryerArt color={color} />}
      {kind === 'robot' && <RobotArt color={color} />}
      {kind === 'watch' && <WatchArt color={color} />}
      {kind === 'speaker' && <SpeakerArt color={color} />}
    </svg>
  )
}

const light = '#EAF1FF'
const edge = 'rgba(20,35,52,0.14)'

function PhoneArt({ color }: { color: string }) {
  return (
    <g>
      <rect x="62" y="22" width="76" height="152" rx="18" fill={color} />
      <rect x="69" y="33" width="62" height="130" rx="11" fill={light} />
      <rect x="69" y="33" width="62" height="62" rx="11" fill={color} opacity="0.18" />
      <circle cx="100" cy="158" r="5" fill="none" stroke={edge} strokeWidth="2" />
      <rect x="88" y="26" width="24" height="4" rx="2" fill={edge} />
    </g>
  )
}

function LaptopArt({ color }: { color: string }) {
  return (
    <g>
      <rect x="48" y="42" width="104" height="68" rx="9" fill={color} />
      <rect x="55" y="49" width="90" height="54" rx="5" fill={light} />
      <rect x="55" y="49" width="42" height="54" rx="5" fill={color} opacity="0.2" />
      <path
        d="M40 112h120a5 5 0 0 1 5 5l3 10a5 5 0 0 1-5 6H37a5 5 0 0 1-5-6l3-10a5 5 0 0 1 5-5Z"
        fill={light}
        stroke={edge}
        strokeWidth="1.5"
      />
      <rect x="86" y="118" width="28" height="6" rx="3" fill={edge} />
    </g>
  )
}

function TabletArt({ color }: { color: string }) {
  return (
    <g>
      <rect x="42" y="32" width="116" height="136" rx="16" fill={color} />
      <rect x="51" y="43" width="98" height="114" rx="9" fill={light} />
      <rect x="51" y="43" width="98" height="50" rx="9" fill={color} opacity="0.2" />
      <circle cx="100" cy="167" r="4" fill={edge} />
    </g>
  )
}

function TvArt({ color }: { color: string }) {
  return (
    <g>
      <rect x="18" y="42" width="164" height="94" rx="10" fill={color} />
      <rect x="25" y="49" width="150" height="80" rx="6" fill={light} />
      <rect x="25" y="49" width="70" height="80" rx="6" fill={color} opacity="0.16" />
      <rect x="88" y="136" width="24" height="16" rx="4" fill={color} opacity="0.55" />
      <rect x="62" y="152" width="76" height="7" rx="3.5" fill={light} stroke={edge} strokeWidth="1.5" />
    </g>
  )
}

function HeadphonesArt({ color }: { color: string }) {
  return (
    <g>
      <path
        d="M52 112V96a48 48 0 0 1 96 0v16"
        fill="none"
        stroke={color}
        strokeWidth="13"
        strokeLinecap="round"
      />
      <rect x="36" y="100" width="32" height="54" rx="15" fill={color} />
      <rect x="132" y="100" width="32" height="54" rx="15" fill={color} />
      <ellipse cx="52" cy="127" rx="8" ry="17" fill={light} />
      <ellipse cx="148" cy="127" rx="8" ry="17" fill={light} />
    </g>
  )
}

function WasherArt({ color }: { color: string }) {
  return (
    <g>
      <rect
        x="38"
        y="28"
        width="124"
        height="148"
        rx="18"
        fill="#FDFEFF"
        stroke={edge}
        strokeWidth="2"
      />
      <path d="M38 46a18 18 0 0 1 18-18h88a18 18 0 0 1 18 18v12H38Z" fill={color} />
      <circle cx="56" cy="43" r="5.5" fill="#fff" opacity="0.85" />
      <circle cx="74" cy="43" r="5.5" fill="#fff" opacity="0.55" />
      <rect x="112" y="37" width="34" height="12" rx="6" fill="#fff" opacity="0.7" />
      <circle cx="100" cy="118" r="36" fill={light} />
      <circle cx="100" cy="118" r="36" fill="none" stroke={edge} strokeWidth="2" />
      <circle cx="100" cy="118" r="24" fill={color} opacity="0.22" />
      <path d="M82 118a18 18 0 0 1 36 0" fill="none" stroke={color} strokeWidth="3" opacity="0.5" />
    </g>
  )
}

function CoffeeArt({ color }: { color: string }) {
  return (
    <g>
      <rect x="52" y="52" width="96" height="98" rx="14" fill={color} />
      <rect x="52" y="38" width="96" height="22" rx="11" fill={light} stroke={edge} strokeWidth="1.5" />
      <circle cx="70" cy="49" r="5" fill={color} />
      <rect x="120" y="44" width="18" height="10" rx="5" fill={edge} />
      <rect x="92" y="92" width="16" height="12" rx="3" fill={edge} />
      <path
        d="M88 112h24v10a12 12 0 0 1-24 0Z"
        fill="#fff"
        stroke={edge}
        strokeWidth="2"
      />
      <path d="M112 116h6a6 6 0 0 1 0 12h-6" fill="none" stroke={edge} strokeWidth="2" />
      <rect x="64" y="132" width="72" height="4" rx="2" fill="#fff" opacity="0.4" />
    </g>
  )
}

function FryerArt({ color }: { color: string }) {
  return (
    <g>
      <rect x="54" y="52" width="92" height="34" rx="16" fill={light} stroke={edge} strokeWidth="1.5" />
      <rect x="54" y="76" width="92" height="80" rx="20" fill={color} />
      <rect x="66" y="90" width="48" height="52" rx="12" fill="#fff" opacity="0.25" />
      <rect x="132" y="98" width="38" height="15" rx="7.5" fill={edge} />
      <path d="M70 66h28M104 66h26" stroke={color} strokeWidth="3" strokeLinecap="round" opacity="0.6" />
      <circle cx="130" cy="112" r="3.5" fill="#fff" opacity="0.7" />
      <circle cx="130" cy="126" r="3.5" fill="#fff" opacity="0.7" />
    </g>
  )
}

function RobotArt({ color }: { color: string }) {
  return (
    <g>
      <circle cx="100" cy="112" r="48" fill={color} />
      <circle cx="100" cy="112" r="48" fill="none" stroke={edge} strokeWidth="2" />
      <circle cx="100" cy="103" r="17" fill="#fff" opacity="0.85" />
      <rect x="93" y="99" width="14" height="8" rx="4" fill={edge} />
      <path
        d="M64 136a40 40 0 0 0 72 0"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        opacity="0.35"
      />
      <circle cx="100" cy="152" r="4" fill="#fff" opacity="0.6" />
    </g>
  )
}

function WatchArt({ color }: { color: string }) {
  return (
    <g>
      <rect x="82" y="30" width="36" height="38" rx="11" fill={color} />
      <rect x="82" y="132" width="36" height="38" rx="11" fill={color} />
      <rect x="68" y="60" width="64" height="80" rx="20" fill={color} />
      <rect x="76" y="70" width="48" height="60" rx="13" fill="#1B2B3E" />
      <rect x="84" y="84" width="24" height="6" rx="3" fill="#fff" opacity="0.9" />
      <rect x="84" y="96" width="32" height="5" rx="2.5" fill={color} opacity="0.9" />
      <rect x="84" y="108" width="18" height="5" rx="2.5" fill="#fff" opacity="0.4" />
      <rect x="136" y="90" width="6" height="18" rx="3" fill={edge} />
    </g>
  )
}

function SpeakerArt({ color }: { color: string }) {
  return (
    <g>
      <path d="M84 50a16 16 0 0 1 32 0" fill="none" stroke={edge} strokeWidth="6" strokeLinecap="round" />
      <rect x="66" y="50" width="68" height="118" rx="24" fill={color} />
      <g fill="#fff" opacity="0.5">
        <circle cx="84" cy="76" r="4" />
        <circle cx="100" cy="76" r="4" />
        <circle cx="116" cy="76" r="4" />
        <circle cx="84" cy="94" r="4" />
        <circle cx="100" cy="94" r="4" />
        <circle cx="116" cy="94" r="4" />
        <circle cx="84" cy="112" r="4" />
        <circle cx="100" cy="112" r="4" />
        <circle cx="116" cy="112" r="4" />
      </g>
      <rect x="84" y="138" width="32" height="10" rx="5" fill="#fff" opacity="0.35" />
    </g>
  )
}
