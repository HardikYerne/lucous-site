"use client";

import * as React from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Lightbulb, RotateCcw, Sparkles } from "lucide-react";
import type { LanguageCode } from "@/lib/tutor-languages";

interface DiagramProps {
  language?: LanguageCode;
  className?: string;
}

// ---------------------------------------------------------------------------
// 1. PHOTOSYNTHESIS INTERACTIVE PROCESS DIAGRAM
// ---------------------------------------------------------------------------

export function PhotosynthesisDiagram({ language = "en", className }: DiagramProps) {
  const [activeStep, setActiveStep] = React.useState<number>(1);

  const labels = {
    en: {
      title: "Photosynthesis Process (प्रकाश संश्लेषण / కిరణజన్య సంయోగక్రియ)",
      equation: "6CO₂ (Carbon Dioxide) + 6H₂O (Water) + Sunlight ➔ C₆H₁₂O₆ (Glucose) + 6O₂ (Oxygen)",
      step1: "1. Sunlight Absorption",
      step1Desc: "Chlorophyll in the green leaves absorbs solar photon energy from the Sun.",
      step2: "2. Water & CO₂ Intake",
      step2Desc: "Roots absorb water from soil; microscopic pores (stomata) absorb Carbon Dioxide from air.",
      step3: "3. Glucose & Oxygen Release",
      step3Desc: "Chemical reactions produce glucose (food for plant) and release oxygen into the atmosphere.",
      sun: "Sunlight (Light Energy)",
      leaf: "Leaf (Chlorophyll)",
      co2: "CO₂ Enters",
      o2: "O₂ Released",
      water: "H₂O Absorbed by Roots",
      glucose: "Glucose (Food)",
    },
    hi: {
      title: "प्रकाश संश्लेषण प्रक्रिया (Photosynthesis)",
      equation: "6CO₂ (कार्बन डाइऑक्साइड) + 6H₂O (जल) + सूर्य का प्रकाश ➔ C₆H₁₂O₆ (ग्लूकोज) + 6O₂ (ऑक्सीजन)",
      step1: "१. सूर्य प्रकाश अवशोषण",
      step1Desc: "हरी पत्तियों में मौजूद क्लोरोफिल (Chlorophyll) सूर्य से प्रकाश ऊर्जा को अवशोषित करता है।",
      step2: "२. जल और CO₂ ग्रहण",
      step2Desc: "जड़ें मिट्टी से जल अवशोषित करती हैं और रंध्र (Stomata) हवा से कार्बन डाइऑक्साइड लेते हैं।",
      step3: "३. भोजन और ऑक्सीजन निर्माण",
      step3Desc: "रासायनिक क्रिया से ग्लूकोज (भोजन) बनता है और प्राणवायु ऑक्सीजन वातावरण में मुक्त होती है।",
      sun: "सूर्य प्रकाश (सौर ऊर्जा)",
      leaf: "पत्ती (क्लोरोफिल)",
      co2: "CO₂ प्रवेश",
      o2: "O₂ निकास",
      water: "जड़ों द्वारा जल अवशोषण",
      glucose: "ग्लूकोज (भोजन)",
    },
    mr: {
      title: "प्रकाशसंश्लेषण प्रक्रिया (Photosynthesis)",
      equation: "6CO₂ (कार्बन डायऑक्साइड) + 6H₂O (पाणी) + सूर्यप्रकाश ➔ C₆H₁₂O₆ (ग्लुकोज) + 6O₂ (ऑक्सिजन)",
      step1: "१. सूर्यप्रकाश शोषण",
      step1Desc: "हिरव्या पानांमधील हरितद्रव्य (Chlorophyll) सूर्याची प्रकाश ऊर्जा शोषून घेते.",
      step2: "२. पाणी व CO₂ चे वहन",
      step2Desc: "मुळे जमिनीतून पाणी शोषतात आणि पर्णरंध्रे (Stomata) हवेतील कार्बन डायऑक्साइड शोषतात.",
      step3: "३. अन्न व ऑक्सिजन निर्मिती",
      step3Desc: "रासायनिक प्रक्रियेतून ग्लुकोज (अन्न) तयार होते आणि हवेत ऑक्सिजन सोडला जातो.",
      sun: "सूर्यप्रकाश (ऊर्जा)",
      leaf: "पान (हरितद्रव्य)",
      co2: "CO₂ शोषण",
      o2: "O₂ बाहेर पडतो",
      water: "मुळांद्वारे पाणी वहन",
      glucose: "ग्लुकोज (अन्न)",
    },
    te: {
      title: "కిరణజన్య సంయోగక్రియ (Photosynthesis)",
      equation: "6CO₂ (కార్బన్ డయాక్సైడ్) + 6H₂O (నీరు) + సూర్యకాంతి ➔ C₆H₁₂O₆ (గ్లూకోజ్) + 6O₂ (ఆక్సిజన్)",
      step1: "1. సూర్యకాంతి శోషణ",
      step1Desc: "ఆకుపచ్చని ఆకులలోని పత్రహరితం (Chlorophyll) సూర్యకాంతి శక్తిని గ్రహిస్తుంది.",
      step2: "2. నీరు & CO₂ గ్రహించడం",
      step2Desc: "వేర్లు నేల నుండి నీటిని, పత్రరంధ్రాలు గాలి నుండి కార్బన్ డయాక్సైడ్ గ్రహిస్తాయి.",
      step3: "3. ఆహారం & ఆక్సిజన్ విడుదల",
      step3Desc: "రసాయన చర్య ద్వారా గ్లూకోజ్ (ఆహారం) తయారవుతుంది, ఆక్సిజన్ గాల్లోకి విడుదలవుతుంది.",
      sun: "సూర్యకాంతి",
      leaf: "ఆకు (పత్రహరితం)",
      co2: "CO₂ లోపలికి",
      o2: "O₂ విడుదల",
      water: "వేర్ల ద్వారా నీరు",
      glucose: "గ్లూకోజ్ (ఆహారం)",
    },
  }[language] || {
    title: "Photosynthesis Process",
    equation: "6CO₂ + 6H₂O + Sunlight ➔ C₆H₁₂O₆ + 6O₂",
    step1: "1. Sunlight Absorption",
    step1Desc: "Chlorophyll absorbs solar photon energy.",
    step2: "2. Water & CO₂ Intake",
    step2Desc: "Roots absorb water; stomata absorb CO₂.",
    step3: "3. Glucose & Oxygen Release",
    step3Desc: "Produces glucose food and releases oxygen.",
    sun: "Sunlight",
    leaf: "Leaf",
    co2: "CO₂",
    o2: "O₂",
    water: "H₂O",
    glucose: "Glucose",
  };

  return (
    <div className={cn("rounded-xl border bg-card/80 p-4 text-xs shadow-xs space-y-3", className)}>
      <div className="flex items-center justify-between border-b pb-2">
        <span className="font-heading font-semibold text-sm text-foreground flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-emerald-600" />
          {labels.title}
        </span>
        <span className="text-[10px] rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 font-medium">
          Interactive Diagram
        </span>
      </div>

      {/* SVG Illustration */}
      <div className="w-full bg-linear-to-b from-sky-50 to-amber-50/30 dark:from-sky-950/20 dark:to-amber-950/10 rounded-lg p-2 border flex justify-center">
        <svg viewBox="0 0 500 240" className="w-full max-w-lg h-auto">
          {/* Sun */}
          <circle cx="70" cy="50" r="30" fill="#FBBF24" className="animate-pulse" />
          <path d="M70,10 L70,18 M70,82 L70,90 M30,50 L38,50 M102,50 L110,50 M42,22 L48,28 M92,72 L98,78 M42,78 L48,72 M92,28 L98,22" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
          <text x="70" y="55" fontSize="11" fontWeight="bold" textAnchor="middle" fill="#78350F">☀️</text>

          {/* Sunlight Rays to Leaf */}
          <path d="M95,65 Q 160,90 220,110" stroke="#F59E0B" strokeWidth="2.5" strokeDasharray="5,4" fill="none" />
          <text x="140" y="80" fontSize="10" fill="#B45309" fontWeight="600">{labels.sun}</text>

          {/* Plant Stem & Leaf */}
          <path d="M260,200 Q 255,160 250,120" stroke="#15803D" strokeWidth="6" fill="none" />
          {/* Big Green Leaf */}
          <path d="M250,120 C 180,90 170,140 250,140 C 330,140 320,90 250,120 Z" fill={activeStep === 1 ? "#22C55E" : "#16A34A"} stroke="#14532D" strokeWidth="2" />
          <text x="250" y="125" fontSize="11" fontWeight="bold" textAnchor="middle" fill="#FFFFFF">{labels.leaf}</text>

          {/* CO2 Inflow Arrow */}
          <path d="M140,150 L 195,135" stroke="#3B82F6" strokeWidth="2.5" markerEnd="url(#arrow)" />
          <text x="130" y="165" fontSize="10" fill="#1D4ED8" fontWeight="600">{labels.co2}</text>

          {/* O2 Outflow Arrow */}
          <path d="M305,135 L 360,115" stroke="#10B981" strokeWidth="2.5" />
          <polygon points="360,115 350,113 355,123" fill="#10B981" />
          <text x="365" y="115" fontSize="10" fill="#047857" fontWeight="600">{labels.o2}</text>

          {/* Soil & Roots */}
          <rect x="180" y="195" width="140" height="40" fill="#78350F" opacity="0.2" rx="4" />
          <path d="M260,200 L 240,230 M260,200 L 260,235 M260,200 L 280,228" stroke="#92400E" strokeWidth="2.5" strokeLinecap="round" />
          <text x="260" y="218" fontSize="10" textAnchor="middle" fill="#78350F" fontWeight="600">{labels.water}</text>

          {/* Glucose Produced */}
          <rect x="220" y="155" width="60" height="20" rx="6" fill="#FDE047" stroke="#CA8A04" strokeWidth="1.5" />
          <text x="250" y="169" fontSize="9" fontWeight="bold" textAnchor="middle" fill="#854D0E">{labels.glucose}</text>
        </svg>
      </div>

      {/* Chemical Equation Bar */}
      <div className="rounded-md bg-muted/60 p-2 text-center font-mono text-[11px] font-semibold text-primary">
        {labels.equation}
      </div>

      {/* Step Buttons */}
      <div className="grid grid-cols-3 gap-1.5 pt-1">
        {[
          { step: 1, label: labels.step1, desc: labels.step1Desc },
          { step: 2, label: labels.step2, desc: labels.step2Desc },
          { step: 3, label: labels.step3, desc: labels.step3Desc },
        ].map((item) => (
          <button
            key={item.step}
            type="button"
            onClick={() => setActiveStep(item.step)}
            className={cn(
              "p-2 rounded-lg border text-left transition text-[11px]",
              activeStep === item.step
                ? "border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-200 font-semibold shadow-xs"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            <p className="font-medium line-clamp-1">{item.label}</p>
          </button>
        ))}
      </div>

      {/* Active Step Description */}
      <div className="p-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-xs text-foreground leading-relaxed">
        {activeStep === 1 && labels.step1Desc}
        {activeStep === 2 && labels.step2Desc}
        {activeStep === 3 && labels.step3Desc}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. FRACTIONS INTERACTIVE VISUALIZER (PIE & BAR)
// ---------------------------------------------------------------------------

export function FractionsDiagram({ language = "en", className }: DiagramProps) {
  const [numerator, setNumerator] = React.useState<number>(3);
  const [denominator, setDenominator] = React.useState<number>(4);

  const labels = {
    en: {
      title: "Interactive Fractions Visualizer (अपूर्णांक / భిన్నాలు)",
      numerator: "Numerator (Parts chosen)",
      denominator: "Denominator (Total equal parts)",
      fraction: "Fraction",
      decimal: "Decimal",
      percentage: "Percentage",
    },
    hi: {
      title: "भिन्न प्रदर्शक (Interactive Fractions)",
      numerator: "अंश / Numerator (चुने गए भाग)",
      denominator: "हर / Denominator (कुल समान भाग)",
      fraction: "भिन्न",
      decimal: "दशमलव",
      percentage: "प्रतिशत",
    },
    mr: {
      title: "अपूर्णांक आकृती प्रदर्शक (Fractions Visualizer)",
      numerator: "अंश (घेतलेले भाग)",
      denominator: "च्छेद (एकूण समान भाग)",
      fraction: "अपूर्णांक",
      decimal: "दशांश",
      percentage: "टक्केवारी",
    },
    te: {
      title: "భిన్నాల దృశ్యరూపం (Interactive Fractions)",
      numerator: "లవం (ఎంచుకున్న భాగాలు)",
      denominator: "హారం (మొత్తం సమాన భాగాలు)",
      fraction: "భిన్నం",
      decimal: "దశాంశం",
      percentage: "శాతం",
    },
  }[language] || {
    title: "Interactive Fractions Visualizer",
    numerator: "Numerator",
    denominator: "Denominator",
    fraction: "Fraction",
    decimal: "Decimal",
    percentage: "Percentage",
  };

  const percentage = Math.round((numerator / denominator) * 100);
  const decimal = (numerator / denominator).toFixed(2);

  // SVG Pie Slices
  const slices = Array.from({ length: denominator }, (_, i) => {
    const startAngle = (i * 2 * Math.PI) / denominator - Math.PI / 2;
    const endAngle = ((i + 1) * 2 * Math.PI) / denominator - Math.PI / 2;
    const r = 60;
    const cx = 80;
    const cy = 80;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);

    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    const pathData = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    const isSelected = i < numerator;
    return (
      <path
        key={i}
        d={pathData}
        fill={isSelected ? "#3B82F6" : "#E2E8F0"}
        stroke="#FFFFFF"
        strokeWidth="2"
        className="transition-colors duration-200"
      />
    );
  });

  return (
    <div className={cn("rounded-xl border bg-card/80 p-4 text-xs shadow-xs space-y-3", className)}>
      <div className="flex items-center justify-between border-b pb-2">
        <span className="font-heading font-semibold text-sm text-foreground flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-blue-600" />
          {labels.title}
        </span>
        <span className="text-sm font-mono font-bold text-primary">
          {numerator} / {denominator}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        {/* Pie Diagram */}
        <div className="flex justify-center items-center p-2 bg-muted/20 rounded-lg">
          <svg viewBox="0 0 160 160" className="w-36 h-36">
            {slices}
            <circle cx="80" cy="80" r="14" fill="#FFFFFF" />
            <text x="80" y="84" fontSize="10" fontWeight="bold" textAnchor="middle" fill="#1E293B">
              {numerator}/{denominator}
            </text>
          </svg>
        </div>

        {/* Bar & Fraction Metrics */}
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-[11px] text-muted-foreground mb-1 font-medium">
              <span>{labels.fraction}: <strong className="text-foreground">{numerator}/{denominator}</strong></span>
              <span>{labels.percentage}: <strong className="text-foreground">{percentage}%</strong></span>
            </div>
            {/* Divided Bar */}
            <div className="flex h-6 w-full rounded-md border overflow-hidden">
              {Array.from({ length: denominator }, (_, i) => (
                <div
                  key={i}
                  style={{ width: `${100 / denominator}%` }}
                  className={cn(
                    "border-r last:border-r-0 transition-colors duration-200",
                    i < numerator ? "bg-blue-500" : "bg-muted"
                  )}
                />
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground font-medium">{labels.numerator}: {numerator}</span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 w-6 p-0 text-xs"
                  disabled={numerator <= 1}
                  onClick={() => setNumerator((n) => Math.max(1, n - 1))}
                >
                  -
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 w-6 p-0 text-xs"
                  disabled={numerator >= denominator}
                  onClick={() => setNumerator((n) => Math.min(denominator, n + 1))}
                >
                  +
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground font-medium">{labels.denominator}: {denominator}</span>
              <div className="flex gap-1">
                {[2, 3, 4, 6, 8].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setDenominator(d);
                      if (numerator > d) setNumerator(d);
                    }}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-medium border transition",
                      denominator === d
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. PYTHAGORAS THEOREM GEOMETRY VISUALIZER
// ---------------------------------------------------------------------------

export function PythagorasDiagram({ language = "en", className }: DiagramProps) {
  const [a, setA] = React.useState<number>(3);
  const [b, setB] = React.useState<number>(4);

  const c = Math.sqrt(a * a + b * b);
  const cFormatted = Number.isInteger(c) ? c.toString() : c.toFixed(2);

  const labels = {
    en: {
      title: "Pythagoras Theorem: a² + b² = c²",
      base: "Base (a)",
      height: "Height (b)",
      hypotenuse: "Hypotenuse (c)",
      formula: `(${a})² + (${b})² = ${a * a} + ${b * b} = ${a * a + b * b} = (${cFormatted})²`,
    },
    hi: {
      title: "पाइथागोरस प्रमेय: आधार² + लम्ब² = कर्ण²",
      base: "आधार / Base (a)",
      height: "लम्ब / Height (b)",
      hypotenuse: "कर्ण / Hypotenuse (c)",
      formula: `(${a})² + (${b})² = ${a * a} + ${b * b} = ${a * a + b * b} = (${cFormatted})²`,
    },
    mr: {
      title: "पायथागोरसचा सिद्धांत: पाया² + उंची² = कर्ण²",
      base: "पाया (a)",
      height: "उंची (b)",
      hypotenuse: "कर्ण (c)",
      formula: `(${a})² + (${b})² = ${a * a} + ${b * b} = ${a * a + b * b} = (${cFormatted})²`,
    },
    te: {
      title: "పైథాగరస్ సిద్ధాంతం: భుజం² + భుజం² = కర్ణం²",
      base: "ఆధారం / Base (a)",
      height: "ఎత్తు / Height (b)",
      hypotenuse: "కర్ణం / Hypotenuse (c)",
      formula: `(${a})² + (${b})² = ${a * a} + ${b * b} = ${a * a + b * b} = (${cFormatted})²`,
    },
  }[language] || {
    title: "Pythagoras Theorem: a² + b² = c²",
    base: "Base (a)",
    height: "Height (b)",
    hypotenuse: "Hypotenuse (c)",
    formula: `(${a})² + (${b})² = (${cFormatted})²`,
  };

  return (
    <div className={cn("rounded-xl border bg-card/80 p-4 text-xs shadow-xs space-y-3", className)}>
      <div className="flex items-center justify-between border-b pb-2">
        <span className="font-heading font-semibold text-sm text-foreground flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-indigo-600" />
          {labels.title}
        </span>
        <span className="font-mono text-xs font-bold text-indigo-600">
          c = {cFormatted}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        {/* Right Triangle Drawing */}
        <div className="flex justify-center items-center p-2 bg-muted/20 rounded-lg">
          <svg viewBox="0 0 200 160" className="w-48 h-36">
            {/* Right Triangle */}
            <polygon
              points="40,130 160,130 40,30"
              fill="rgba(99, 102, 241, 0.15)"
              stroke="#6366F1"
              strokeWidth="2.5"
            />
            {/* Right Angle Symbol */}
            <rect x="40" y="115" width="15" height="15" fill="none" stroke="#6366F1" strokeWidth="1.5" />

            {/* Labels */}
            <text x="100" y="146" fontSize="11" fontWeight="bold" textAnchor="middle" fill="#4338CA">
              a = {a}
            </text>
            <text x="24" y="85" fontSize="11" fontWeight="bold" textAnchor="middle" fill="#4338CA">
              b = {b}
            </text>
            <text x="115" y="70" fontSize="11" fontWeight="bold" textAnchor="middle" fill="#1E1B4B">
              c = {cFormatted}
            </text>
          </svg>
        </div>

        {/* Calculation & Slider Controls */}
        <div className="space-y-3">
          <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 font-mono text-[11px] text-indigo-900 dark:text-indigo-200 text-center font-semibold">
            {labels.formula}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">{labels.base}: <strong>{a}</strong></span>
              <div className="flex gap-1">
                {[3, 5, 6, 8].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setA(val)}
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] border transition",
                      a === val ? "bg-indigo-600 text-white font-bold" : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">{labels.height}: <strong>{b}</strong></span>
              <div className="flex gap-1">
                {[4, 6, 8, 12].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setB(val)}
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] border transition",
                      b === val ? "bg-indigo-600 text-white font-bold" : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. WATER CYCLE PROCESS DIAGRAM
// ---------------------------------------------------------------------------

export function WaterCycleDiagram({ language = "en", className }: DiagramProps) {
  const [activeStage, setActiveStage] = React.useState<number>(1);

  const labels = {
    en: {
      title: "The Water Cycle (जल चक्र / నీటి చక్రం)",
      stage1: "1. Evaporation",
      stage1Desc: "Solar heat warms oceans, lakes, and rivers, turning liquid water into invisible water vapor that rises.",
      stage2: "2. Condensation",
      stage2Desc: "Water vapor cools as it ascends high into the atmosphere, grouping into water droplets to form clouds.",
      stage3: "3. Precipitation",
      stage3Desc: "When cloud droplets become too heavy, they fall back to Earth as rain, snow, or hail.",
      stage4: "4. Collection",
      stage4Desc: "Fallen water collects in rivers, lakes, and groundwater aquifers, flowing back into oceans to repeat the cycle.",
    },
    hi: {
      title: "जल चक्र (The Water Cycle)",
      stage1: "१. वाष्पीकरण (Evaporation)",
      stage1Desc: "सूर्य की गर्मी से नदियों और समुद्रों का जल भाप बनकर आकाश में ऊपर उठता है।",
      stage2: "२. संघनन (Condensation)",
      stage2Desc: "ऊपर पहुंचकर भाप ठंडी होती है और जल की नन्हीं बूंदों में बदलकर बादलों का रूप लेती है।",
      stage3: "३. वर्षण / वर्षा (Precipitation)",
      stage3Desc: "जब बादलों में जल की बूंदें भारी हो जाती हैं, तो वे बारिश या बर्फ के रूप में धरती पर गिरती हैं।",
      stage4: "४. संचयन (Collection)",
      stage4Desc: "वर्षा का जल नदियों और भूजल के माध्यम से वापस सागर में पहुंचता है और चक्र चलता रहता है।",
    },
    mr: {
      title: "जलचक्र (The Water Cycle)",
      stage1: "१. बाष्पीभवन (Evaporation)",
      stage1Desc: "सूर्याच्या उष्णतेमुळे समुद्र, नद्यांमधील पाण्याचे बाष्प (वाफ) होऊन ते आकाशात वर जाते.",
      stage2: "२. संघनन (Condensation)",
      stage2Desc: "वर गेलेली पाण्याची वाफ थंड होऊन पाण्याचे सूक्ष्म थेंब तयार होतात आणि ढग बनतात.",
      stage3: "३. पर्जन्य / पाऊस (Precipitation)",
      stage3Desc: "ढगांमधील पाण्याचे थेंब जड झाल्यावर ते पावसाच्या किंवा गारांच्या रूपाने जमिनीवर कोसळतात.",
      stage4: "४. संकलन (Collection)",
      stage4Desc: "पावसाचे पाणी नद्या, ओढ्यांद्वारे पुन्हा समुद्राला मिळते आणि जलचक्र अखंड सुरू राहते.",
    },
    te: {
      title: "నీటి చక్రం (The Water Cycle)",
      stage1: "1. బాష్పీభవనం (Evaporation)",
      stage1Desc: "సూర్యుడి వేడికి సముద్రాలు, నదులలోని నీరు ఆవిరిగా మారి పైకి లేస్తుంది.",
      stage2: "2. సాంద్రీకరణం (Condensation)",
      stage2Desc: "పైకి చేరిన నీటి ఆవిరి చల్లబడి చిన్న బిందువులుగా మారి మేఘాలుగా ఏర్పడుతుంది.",
      stage3: "3. అవపాతం / వర్షం (Precipitation)",
      stage3Desc: "మేఘాలు బరువెక్కినప్పుడు నీటి బిందువులు వర్షం లేదా మంచు రూపంలో భూమిపై పడతాయి.",
      stage4: "4. సేకరణ (Collection)",
      stage4Desc: "వర్షపు నీరు నదులు, భూగర్భ జలాల ద్వారా తిరిగి సముద్రాలకు చేరి చక్రం పునరావృతమవుతుంది.",
    },
  }[language] || {
    title: "The Water Cycle",
    stage1: "1. Evaporation",
    stage1Desc: "Water turns into vapor and rises.",
    stage2: "2. Condensation",
    stage2Desc: "Vapor cools and forms clouds.",
    stage3: "3. Precipitation",
    stage3Desc: "Drops fall as rain or snow.",
    stage4: "4. Collection",
    stage4Desc: "Water flows back into oceans.",
  };

  return (
    <div className={cn("rounded-xl border bg-card/80 p-4 text-xs shadow-xs space-y-3", className)}>
      <div className="flex items-center justify-between border-b pb-2">
        <span className="font-heading font-semibold text-sm text-foreground flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-sky-600" />
          {labels.title}
        </span>
      </div>

      {/* SVG Diagram */}
      <div className="w-full bg-linear-to-b from-sky-100/50 to-blue-50/20 dark:from-sky-950/20 dark:to-blue-950/10 rounded-lg p-2 border flex justify-center">
        <svg viewBox="0 0 500 220" className="w-full max-w-lg h-auto">
          {/* Sun */}
          <circle cx="60" cy="45" r="24" fill="#FBBF24" />
          <path d="M60,15 L60,8 M60,75 L60,82 M25,45 L18,45 M95,45 L102,45" stroke="#F59E0B" strokeWidth="2.5" />

          {/* Mountains */}
          <polygon points="320,180 400,60 480,180" fill="#94A3B8" />
          <polygon points="370,105 400,60 430,105" fill="#FFFFFF" />

          {/* Clouds */}
          <path d="M200,60 Q215,40 240,45 Q265,35 285,55 Q305,50 315,65 Q325,80 305,90 L195,90 Q180,80 200,60 Z" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1.5" />

          {/* Rain / Precipitation */}
          <path d="M220,105 L215,125 M245,105 L240,125 M270,105 L265,125 M295,105 L290,125" stroke="#38BDF8" strokeWidth="2" strokeDasharray="4,3" />

          {/* Evaporation Waves */}
          <path d="M90,165 Q85,135 95,115 M115,165 Q110,135 120,115" stroke="#F59E0B" strokeWidth="2" strokeDasharray="3,3" fill="none" />

          {/* Ocean Water */}
          <rect x="0" y="170" width="340" height="50" fill="#38BDF8" opacity="0.7" rx="4" />
          <path d="M0,170 Q40,165 80,170 T160,170 T240,170 T320,170" stroke="#0284C7" strokeWidth="2" fill="none" />

          {/* Stage Labels */}
          <text x="105" y="105" fontSize="10" fontWeight="bold" fill="#B45309">1. Evaporation</text>
          <text x="250" y="30" fontSize="10" fontWeight="bold" fill="#475569" textAnchor="middle">2. Condensation</text>
          <text x="255" y="145" fontSize="10" fontWeight="bold" fill="#0284C7">3. Precipitation</text>
          <text x="150" y="200" fontSize="10" fontWeight="bold" fill="#FFFFFF" textAnchor="middle">4. Collection (Ocean)</text>
        </svg>
      </div>

      {/* Stage Selector Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
        {[
          { stage: 1, label: labels.stage1, desc: labels.stage1Desc },
          { stage: 2, label: labels.stage2, desc: labels.stage2Desc },
          { stage: 3, label: labels.stage3, desc: labels.stage3Desc },
          { stage: 4, label: labels.stage4, desc: labels.stage4Desc },
        ].map((item) => (
          <button
            key={item.stage}
            type="button"
            onClick={() => setActiveStage(item.stage)}
            className={cn(
              "p-2 rounded-lg border text-left transition text-[11px]",
              activeStage === item.stage
                ? "border-sky-500 bg-sky-50 text-sky-950 dark:bg-sky-950/40 dark:text-sky-200 font-semibold shadow-xs"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            <p className="line-clamp-1">{item.label}</p>
          </button>
        ))}
      </div>

      <div className="p-2.5 rounded-lg bg-sky-50/50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/40 text-xs text-foreground leading-relaxed">
        {activeStage === 1 && labels.stage1Desc}
        {activeStage === 2 && labels.stage2Desc}
        {activeStage === 3 && labels.stage3Desc}
        {activeStage === 4 && labels.stage4Desc}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. HELPER TO MATCH TOPIC AND RENDER APPROPRIATE DIAGRAM
// ---------------------------------------------------------------------------

export function renderTopicDiagram(topicName: string, language: LanguageCode = "en"): React.ReactNode {
  const normalized = topicName.toLowerCase();

  if (
    normalized.includes("photosynthesis") ||
    normalized.includes("प्रकाश संश्लेषण") ||
    normalized.includes("प्रकाशसंश्लेषण") ||
    normalized.includes("కిరణజన్య సంయోగక్రియ")
  ) {
    return <PhotosynthesisDiagram language={language} />;
  }

  if (
    normalized.includes("fraction") ||
    normalized.includes("भिन्न") ||
    normalized.includes("अपूर्णांक") ||
    normalized.includes("భిన్నం") ||
    normalized.includes("భిన్నాలు")
  ) {
    return <FractionsDiagram language={language} />;
  }

  if (
    normalized.includes("pythagoras") ||
    normalized.includes("पाइथागोरस") ||
    normalized.includes("पायथागोरस") ||
    normalized.includes("పైథాగరస్") ||
    normalized.includes("triangle") ||
    normalized.includes("त्रिकोण")
  ) {
    return <PythagorasDiagram language={language} />;
  }

  if (
    normalized.includes("water cycle") ||
    normalized.includes("जल चक्र") ||
    normalized.includes("जलचक्र") ||
    normalized.includes("నీటి చక్రం")
  ) {
    return <WaterCycleDiagram language={language} />;
  }

  return null;
}
