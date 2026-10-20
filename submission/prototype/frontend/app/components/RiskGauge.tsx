import React from "react";

interface RiskGaugeProps {
  probability?: number | null;
  riskBand?: string | null;
  recommendation?: string | null;
}

export function RiskGauge({ probability, riskBand, recommendation }: RiskGaugeProps) {
  const isScored = typeof probability === "number";
  const pct = isScored ? Math.min(Math.max(probability * 100, 0), 100) : 0;
  const displayPct = isScored ? `${pct.toFixed(1)}%` : "--";

  // Arc calculation for SVG semicircle (radius 70, stroke 14)
  // Semicircle perimeter = PI * r = 3.14159 * 70 ≈ 220
  const radius = 70;
  const strokeWidth = 14;
  const perimeter = Math.PI * radius;
  const strokeDashoffset = isScored ? perimeter - (pct / 100) * perimeter : perimeter;

  let strokeColor = "#176B4D"; // default brand green
  if (riskBand === "HIGH") strokeColor = "#CF5555";
  else if (riskBand === "MODERATE") strokeColor = "#D99A27";
  else if (riskBand === "LOW") strokeColor = "#238354";

  return (
    <div className="bg-white rounded-[22px] p-6 border border-[#E8ECE9] shadow-xs flex flex-col items-center justify-between">
      <div className="w-full flex items-center justify-between mb-2">
        <h4 className="text-sm font-bold text-[#111713]">Model Risk Gauge</h4>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#E7F3EB] text-[#176B4D]">
          {riskBand || "Pending"}
        </span>
      </div>

      {/* Semicircular SVG Gauge matching Denezo's Project Progress meter */}
      <div className="relative w-48 h-28 flex items-end justify-center my-2">
        <svg viewBox="0 0 180 100" className="w-full h-full overflow-visible">
          {/* Background track arc */}
          <path
            d="M 20 90 A 70 70 0 0 1 160 90"
            fill="none"
            stroke="#E8ECE9"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Active progress arc */}
          {isScored && (
            <path
              d="M 20 90 A 70 70 0 0 1 160 90"
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={perimeter}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          )}
        </svg>

        {/* Center Readout */}
        <div className="absolute inset-x-0 bottom-1 flex flex-col items-center text-center">
          <span className="text-2xl font-black tracking-tight text-[#111713] leading-none">
            {displayPct}
          </span>
          <span className="text-[11px] font-medium text-[#758079] mt-0.5">
            {isScored ? "Est. Default Prob." : "Awaiting Score"}
          </span>
        </div>
      </div>

      {/* Sub-label Recommendation */}
      <div className="text-center mt-1 mb-3">
        <div className="text-xs font-semibold text-[#111713]">
          {recommendation || "Run Decision Tree to evaluate applicant"}
        </div>
        <div className="text-[10px] text-[#758079]">
          Decision Tree deterministic leaf assignment
        </div>
      </div>

      {/* Legend Dots matching Denezo */}
      <div className="w-full pt-3 border-t border-[#E8ECE9] flex items-center justify-center gap-4 text-[10px] text-[#758079]">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#238354]"></span>
          <span>Low (&le;35%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#D99A27]"></span>
          <span>Mod (35-65%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#CF5555]"></span>
          <span>High (&gt;65%)</span>
        </div>
      </div>
    </div>
  );
}
