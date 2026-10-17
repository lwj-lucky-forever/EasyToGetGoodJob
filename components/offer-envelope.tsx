/** Shared illustration, with unique gradient IDs for every instance. */
export function OfferEnvelope({ id }: { id: string }) {
  return <svg viewBox="0 0 160 170" fill="none">
              <defs>
                <linearGradient id={`${id}-envelope`} x1="30" y1="90" x2="133" y2="152" gradientUnits="userSpaceOnUse"><stop stopColor="#A6C8FF" /><stop offset="1" stopColor="#8673F4" /></linearGradient>
                <linearGradient id={`${id}-paper`} x1="56" y1="30" x2="110" y2="121" gradientUnits="userSpaceOnUse"><stop stopColor="white" /><stop offset="1" stopColor="#EDEBFF" /></linearGradient>
              </defs>
              <ellipse cx="80" cy="153" rx="43" ry="7" fill="#6860D6" opacity=".12" />
              <path d="M26 88 80 48l54 40v48a10 10 0 0 1-10 10H36a10 10 0 0 1-10-10Z" fill="#7361D9" stroke="#FFF" strokeWidth="2" />
              <g transform="rotate(8 80 80)"><rect x="44" y="31" width="73" height="96" rx="12" fill={`url(#${id}-paper)`} stroke="white" strokeWidth="2" /><text x="80" y="58" textAnchor="middle" fill="#7963E3" fontSize="15" fontWeight="800" fontFamily="system-ui, sans-serif">OFFER</text><path d="M58 70h42M58 78h28" stroke="#D1CCFA" strokeWidth="4" strokeLinecap="round" /></g>
              <path d="m27 89 53 34 53-34v47a10 10 0 0 1-10 10H37a10 10 0 0 1-10-10Z" fill={`url(#${id}-envelope)`} stroke="#F9F8FF" strokeWidth="2" />
              <path d="m28 140 38-27m66 27-38-27" stroke="#DDD8FF" strokeWidth="2" />
              <circle cx="69" cy="117" r="2.5" fill="#493E8D" /><circle cx="91" cy="117" r="2.5" fill="#493E8D" /><path d="M76 123q4 5 8 0" stroke="#493E8D" strokeWidth="2" strokeLinecap="round" /><ellipse cx="61" cy="123" rx="5" ry="3" fill="#F9B8D4" /><ellipse cx="99" cy="123" rx="5" ry="3" fill="#F9B8D4" />
              <path d="m127 22 4 9 10 1-8 7 2 10-8-5-9 5 2-10-7-7 10-1Z" fill="#FFD378" stroke="#FFF4CF" strokeWidth="2" /><path d="M22 57v12m-6-6h12M140 64v8m-4-4h8" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" />
            </svg>;
}
