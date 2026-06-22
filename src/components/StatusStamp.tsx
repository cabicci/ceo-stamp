import { useId } from "react";
import { useTranslation } from "@/i18n/I18nProvider";

type StatusStampProps = {
  className?: string;
};

/**
 * StatusStamp — the signature "Approved" rubber-stamp impression.
 * The only place in the app where color is used boldly. Static; no motion.
 */
export function StatusStamp({ className = "" }: StatusStampProps) {
  const { t, locale } = useTranslation();
  const filterId = useId();
  const label = t("statusStamp.approved");
  const isArabic = locale === "ar";

  return (
    <span
      className={`inline-block ${className}`}
      style={{ transform: "rotate(-8deg)", transformOrigin: "center" }}
      aria-label={label}
    >
      <svg
        width="180"
        height="64"
        viewBox="0 0 180 64"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block" }}
      >
        <defs>
          <filter id={filterId} x="-10%" y="-20%" width="120%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" />
            <feDisplacementMap in="SourceGraphic" scale="3.2" />
          </filter>
        </defs>
        <g filter={`url(#${filterId})`}>
          <rect
            x="4"
            y="4"
            width="172"
            height="56"
            rx="3"
            fill="none"
            stroke="var(--stamp)"
            strokeWidth="3"
          />
          <rect
            x="10"
            y="10"
            width="160"
            height="44"
            rx="2"
            fill="var(--stamp)"
            opacity="0.94"
          />
          <text
            x="90"
            y={isArabic ? "38" : "39"}
            textAnchor="middle"
            fill="#ffffff"
            fontFamily={isArabic ? "var(--font-arabic)" : "var(--font-sans)"}
            fontSize={isArabic ? "22" : "20"}
            fontWeight="600"
            letterSpacing={isArabic ? "0" : "4"}
            style={{ textTransform: isArabic ? "none" : "uppercase" }}
          >
            {label}
          </text>
        </g>
      </svg>
    </span>
  );
}
