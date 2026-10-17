import { OfferEnvelope } from "@/components/offer-envelope";

/** Decorative milestone badge and floating offers; no actual task state. */
export function PortalSkyElements() {
  return <div className="portal-sky-elements" aria-hidden="true">
    {["near", "middle", "far", "small"].map(position => <div key={position} className={`portal-sky-offer portal-sky-offer-${position}`}>
      <OfferEnvelope id={`sky-offer-${position}`} />
    </div>)}
    <div className="portal-milestone">
      <svg viewBox="0 0 160 170" fill="none">
        <defs><linearGradient id="milestone-glass" x1="30" y1="25" x2="130" y2="145" gradientUnits="userSpaceOnUse"><stop stopColor="#FFFFFF" stopOpacity=".95" /><stop offset="1" stopColor="#DCD7FF" stopOpacity=".8" /></linearGradient><linearGradient id="milestone-check" x1="50" y1="50" x2="110" y2="110" gradientUnits="userSpaceOnUse"><stop stopColor="#9694FF" /><stop offset="1" stopColor="#6253DE" /></linearGradient></defs>
        <ellipse cx="80" cy="152" rx="36" ry="6" fill="#7564D3" opacity=".12" />
        <path d="m55 111-7 34 32-12 32 12-7-34" fill="#B9B4FF" stroke="#F4F1FF" strokeWidth="2" />
        <circle cx="80" cy="76" r="52" fill="url(#milestone-glass)" stroke="white" strokeWidth="2" />
        <circle cx="80" cy="76" r="38" fill="url(#milestone-check)" />
        <path d="m62 76 12 12 24-25" stroke="white" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m127 21 4 10 11 1-8 8 2 11-9-5-9 5 2-11-8-8 11-1Z" fill="#FFD984" stroke="#FFF5D5" strokeWidth="2" />
        <path d="M23 52v12m-6-6h12M137 108v8m-4-4h8" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  </div>;
}
