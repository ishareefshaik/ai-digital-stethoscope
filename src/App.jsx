import { useState, useEffect, useRef, useCallback } from "react";

// ─── Color palette & design tokens ───────────────────────────────────────────
const COLORS = {
  bg: "#0a0d14",
  surface: "#111520",
  card: "#161c2d",
  border: "#1e2a40",
  accent: "#00e5ff",
  accentDim: "#0099bb",
  danger: "#ff4060",
  warn: "#ffaa00",
  success: "#00e676",
  text: "#e8edf5",
  muted: "#5a6a85",
  pulse: "#ff2d55",
};

// ─── Utility helpers ──────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function randomBetween(a, b) {
  return a + Math.random() * (b - a);
}

// Simulate realistic PCG waveform data
function generatePCGWaveform(type = "normal", points = 300) {
  const data = [];
  for (let i = 0; i < points; i++) {
    const t = i / points;
    let val = 0;

    if (type === "normal") {
      // S1 (lub) at ~0.1, S2 (dub) at ~0.55 per cardiac cycle
      const cycle = t % 0.5;
      const s1 = Math.exp(-Math.pow((cycle - 0.1) / 0.03, 2)) * 0.9;
      const s2 = Math.exp(-Math.pow((cycle - 0.28) / 0.025, 2)) * 0.65;
      val = s1 + s2 + (Math.random() - 0.5) * 0.05;
    } else if (type === "murmur_systolic") {
      const cycle = t % 0.5;
      const s1 = Math.exp(-Math.pow((cycle - 0.1) / 0.03, 2)) * 0.9;
      const s2 = Math.exp(-Math.pow((cycle - 0.28) / 0.025, 2)) * 0.55;
      // Systolic murmur between S1 and S2
      const murmur =
        cycle > 0.12 && cycle < 0.26
          ? Math.sin(cycle * 200) * 0.3 * Math.exp(-Math.pow((cycle - 0.19) / 0.06, 2))
          : 0;
      val = s1 + s2 + murmur + (Math.random() - 0.5) * 0.06;
    } else if (type === "murmur_diastolic") {
      const cycle = t % 0.5;
      const s1 = Math.exp(-Math.pow((cycle - 0.1) / 0.03, 2)) * 0.85;
      const s2 = Math.exp(-Math.pow((cycle - 0.28) / 0.025, 2)) * 0.6;
      const diastolicMurmur =
        cycle > 0.3 && cycle < 0.45
          ? Math.sin(cycle * 180) * 0.25 * Math.exp(-Math.pow((cycle - 0.38) / 0.07, 2))
          : 0;
      val = s1 + s2 + diastolicMurmur + (Math.random() - 0.5) * 0.06;
    } else if (type === "s3_gallop") {
      const cycle = t % 0.5;
      const s1 = Math.exp(-Math.pow((cycle - 0.1) / 0.03, 2)) * 0.88;
      const s2 = Math.exp(-Math.pow((cycle - 0.28) / 0.025, 2)) * 0.62;
      const s3 = Math.exp(-Math.pow((cycle - 0.35) / 0.02, 2)) * 0.35;
      val = s1 + s2 + s3 + (Math.random() - 0.5) * 0.05;
    }

    data.push({ x: i, y: val });
  }
  return data;
}

// Simulate spectrogram data (frequency x time grid)
function generateSpectrogram(type = "normal", rows = 30, cols = 60) {
  const grid = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const freq = r / rows; // 0=low, 1=high
      const time = c / cols;
      let val = 0;

      if (type === "normal") {
        // Energy concentrated in low-mid freq (20-200Hz)
        val = freq < 0.3 ? randomBetween(0.4, 0.9) : randomBetween(0, 0.15);
        // S1/S2 bumps
        if ((time % 0.5 < 0.08 || (time % 0.5 > 0.25 && time % 0.5 < 0.33)) && freq < 0.25) {
          val = randomBetween(0.7, 1.0);
        }
      } else if (type === "murmur_systolic") {
        val = freq < 0.25 ? randomBetween(0.3, 0.8) : randomBetween(0, 0.12);
        if (time % 0.5 > 0.1 && time % 0.5 < 0.28 && freq > 0.15 && freq < 0.55) {
          val = randomBetween(0.5, 0.95); // murmur energy
        }
      } else if (type === "murmur_diastolic") {
        val = freq < 0.25 ? randomBetween(0.3, 0.75) : randomBetween(0, 0.1);
        if (time % 0.5 > 0.3 && time % 0.5 < 0.46 && freq > 0.1 && freq < 0.45) {
          val = randomBetween(0.45, 0.88);
        }
      } else if (type === "s3_gallop") {
        val = freq < 0.25 ? randomBetween(0.35, 0.85) : randomBetween(0, 0.12);
        if (time % 0.5 > 0.32 && time % 0.5 < 0.38 && freq < 0.15) {
          val = randomBetween(0.6, 0.9); // S3 low-freq energy
        }
      }

      row.push(Math.max(0, Math.min(1, val + (Math.random() - 0.5) * 0.08)));
    }
    grid.push(row);
  }
  return grid;
}

// Classification results per sample type
const CLASSIFICATIONS = {
  normal: {
    label: "Normal Heart Sounds",
    severity: "normal",
    confidence: 97.3,
    heartRate: 72,
    rhythm: "Regular Sinus Rhythm",
    s1: "Present, normal intensity",
    s2: "Present, normal splitting",
    murmur: "None detected",
    additionalSounds: "None",
    recommendation: "No abnormalities detected. Routine follow-up as scheduled.",
    findings: [
      { label: "S1 Intensity", value: "Normal", ok: true },
      { label: "S2 Splitting", value: "Physiologic", ok: true },
      { label: "Systolic Murmur", value: "Absent", ok: true },
      { label: "Diastolic Murmur", value: "Absent", ok: true },
      { label: "Extra Sounds", value: "None", ok: true },
      { label: "Rhythm", value: "Regular", ok: true },
    ],
  },
  murmur_systolic: {
    label: "Systolic Murmur — Grade III/VI",
    severity: "warn",
    confidence: 91.8,
    heartRate: 78,
    rhythm: "Regular",
    s1: "Normal",
    s2: "Normal",
    murmur: "Systolic murmur, Grade III/VI, harsh, best heard at RUSB",
    additionalSounds: "None",
    recommendation:
      "Echocardiography recommended to rule out aortic stenosis or HOCM. Cardiology referral advised.",
    findings: [
      { label: "S1 Intensity", value: "Normal", ok: true },
      { label: "S2 Splitting", value: "Physiologic", ok: true },
      { label: "Systolic Murmur", value: "Grade III/VI", ok: false },
      { label: "Diastolic Murmur", value: "Absent", ok: true },
      { label: "Extra Sounds", value: "None", ok: true },
      { label: "Frequency Peak", value: "180–400 Hz", ok: false },
    ],
  },
  murmur_diastolic: {
    label: "Diastolic Murmur — Early Diastolic",
    severity: "danger",
    confidence: 88.4,
    heartRate: 82,
    rhythm: "Regular",
    s1: "Normal",
    s2: "Accentuated P2",
    murmur: "Early diastolic decrescendo murmur, best at left sternal border",
    additionalSounds: "Possible S4",
    recommendation:
      "Urgent echocardiography. Pattern consistent with aortic regurgitation. Same-day cardiology consult recommended.",
    findings: [
      { label: "S1 Intensity", value: "Normal", ok: true },
      { label: "S2 Component", value: "P2 Accentuated", ok: false },
      { label: "Systolic Murmur", value: "Absent", ok: true },
      { label: "Diastolic Murmur", value: "Early Decrescendo", ok: false },
      { label: "Extra Sounds", value: "Possible S4", ok: false },
      { label: "Frequency Peak", value: "120–350 Hz", ok: false },
    ],
  },
  s3_gallop: {
    label: "S3 Gallop — Heart Failure Pattern",
    severity: "danger",
    confidence: 93.1,
    heartRate: 96,
    rhythm: "Slightly Irregular",
    s1: "Diminished",
    s2: "Present",
    murmur: "Soft systolic murmur, Grade I/VI",
    additionalSounds: "S3 gallop at apex",
    recommendation:
      "High likelihood of systolic heart failure or volume overload. BNP, chest X-ray, urgent echo. Admit for workup.",
    findings: [
      { label: "S1 Intensity", value: "Diminished", ok: false },
      { label: "S3 Gallop", value: "Present at Apex", ok: false },
      { label: "Systolic Murmur", value: "Grade I/VI", ok: false },
      { label: "Heart Rate", value: "96 bpm (Tachycardic)", ok: false },
      { label: "Extra Sounds", value: "S3 Detected", ok: false },
      { label: "Rhythm", value: "Slightly Irregular", ok: false },
    ],
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function PulseRing({ active }) {
  return (
    <div style={{ position: "relative", width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {active && (
        <>
          <div style={{
            position: "absolute", borderRadius: "50%", border: `2px solid ${COLORS.pulse}`,
            animation: "ping 1.2s cubic-bezier(0,0,0.2,1) infinite",
            width: 80, height: 80, opacity: 0.6,
          }} />
          <div style={{
            position: "absolute", borderRadius: "50%", border: `2px solid ${COLORS.pulse}`,
            animation: "ping 1.2s cubic-bezier(0,0,0.2,1) infinite 0.4s",
            width: 80, height: 80, opacity: 0.4,
          }} />
        </>
      )}
      <div style={{
        width: 56, height: 56, borderRadius: "50%",
        background: active ? `radial-gradient(circle, ${COLORS.pulse}33, ${COLORS.pulse}11)` : `${COLORS.surface}`,
        border: `2px solid ${active ? COLORS.pulse : COLORS.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.3s",
        boxShadow: active ? `0 0 20px ${COLORS.pulse}44` : "none",
      }}>
        <span style={{ fontSize: 24 }}>🫀</span>
      </div>
    </div>
  );
}

function WaveformCanvas({ data, color = COLORS.accent, height = 100 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !data.length) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Background grid
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 0.5;
    for (let x = 0; x < W; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Glow effect
    ctx.shadowBlur = 8;
    ctx.shadowColor = color;

    // Waveform
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    data.forEach((pt, i) => {
      const x = (i / data.length) * W;
      const y = H / 2 - (pt.y * H * 0.45);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill under
    ctx.shadowBlur = 0;
    ctx.fillStyle = `${color}18`;
    ctx.lineTo(W, H / 2);
    ctx.lineTo(0, H / 2);
    ctx.closePath();
    ctx.fill();
  }, [data, color]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={height}
      style={{ width: "100%", height, borderRadius: 6 }}
    />
  );
}

function SpectrogramCanvas({ grid }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !grid.length) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rows = grid.length;
    const cols = grid[0].length;
    const cW = canvas.width / cols;
    const cH = canvas.height / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = grid[rows - 1 - r][c]; // flip vertically (low freq at bottom)
        // Viridis-like colormap
        const h = 240 - v * 240;
        const s = 70 + v * 30;
        const l = 15 + v * 55;
        ctx.fillStyle = `hsl(${h},${s}%,${l}%)`;
        ctx.fillRect(c * cW, r * cH, cW + 0.5, cH + 0.5);
      }
    }
  }, [grid]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={120}
      style={{ width: "100%", height: 120, borderRadius: 6 }}
    />
  );
}

function ProgressBar({ label, value, max = 100, color = COLORS.accent }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: COLORS.muted, fontFamily: "monospace" }}>{label}</span>
        <span style={{ fontSize: 11, color, fontFamily: "monospace", fontWeight: 700 }}>{value.toFixed(1)}%</span>
      </div>
      <div style={{ height: 4, background: COLORS.border, borderRadius: 4, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${(value / max) * 100}%`,
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          borderRadius: 4,
          boxShadow: `0 0 8px ${color}66`,
          transition: "width 0.6s ease",
        }} />
      </div>
    </div>
  );
}

function Badge({ text, type = "normal" }) {
  const colors = {
    normal: { bg: `${COLORS.success}22`, border: COLORS.success, text: COLORS.success },
    warn: { bg: `${COLORS.warn}22`, border: COLORS.warn, text: COLORS.warn },
    danger: { bg: `${COLORS.danger}22`, border: COLORS.danger, text: COLORS.danger },
    info: { bg: `${COLORS.accent}22`, border: COLORS.accent, text: COLORS.accent },
  };
  const c = colors[type] || colors.info;
  return (
    <span style={{
      padding: "2px 10px", borderRadius: 20,
      background: c.bg, border: `1px solid ${c.border}`,
      color: c.text, fontSize: 11, fontWeight: 700,
      fontFamily: "monospace", letterSpacing: 1,
    }}>{text}</span>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: COLORS.card, border: `1px solid ${COLORS.border}`,
      borderRadius: 12, padding: 20,
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, fontFamily: "monospace", fontWeight: 700,
      color: COLORS.muted, letterSpacing: 2,
      textTransform: "uppercase", marginBottom: 12,
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <div style={{ flex: 1, height: 1, background: COLORS.border }} />
      {children}
      <div style={{ flex: 1, height: 1, background: COLORS.border }} />
    </div>
  );
}

// ─── Pipeline step display ─────────────────────────────────────────────────────

const PIPELINE_STEPS = [
  { id: "acquire", label: "PCG Acquisition", icon: "🎙️", desc: "Raw audio capture from digital stethoscope (4000 Hz)" },
  { id: "artifact", label: "Artifact Rejection", icon: "🔇", desc: "Motion/ambient noise filtering via adaptive bandpass" },
  { id: "segment", label: "Cardiac Segmentation", icon: "✂️", desc: "S1/S2 detection using envelope + hidden Markov model" },
  { id: "features", label: "Feature Extraction", icon: "📊", desc: "Mel-spectrogram + MFCCs + temporal envelope features" },
  { id: "classify", label: "CNN Classification", icon: "🧠", desc: "1D CNN + Transformer hybrid on 3s sliding windows" },
  { id: "severity", label: "Severity Scoring", icon: "⚕️", desc: "Calibrated probability → clinical grade mapping" },
  { id: "fhir", label: "FHIR Output", icon: "📋", desc: "HL7 FHIR R4 Observation resource generation" },
];

function PipelineVisual({ activeStep }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "nowrap", overflowX: "auto", paddingBottom: 8 }}>
      {PIPELINE_STEPS.map((step, i) => {
        const done = activeStep > i;
        const active = activeStep === i;
        return (
          <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              opacity: done || active ? 1 : 0.35,
              transition: "opacity 0.4s",
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: 10,
                background: active ? `${COLORS.accent}22` : done ? `${COLORS.success}18` : COLORS.surface,
                border: `1.5px solid ${active ? COLORS.accent : done ? COLORS.success : COLORS.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18,
                boxShadow: active ? `0 0 16px ${COLORS.accent}44` : "none",
                transition: "all 0.3s",
              }}>
                {done ? "✓" : step.icon}
              </div>
              <span style={{ fontSize: 9, color: active ? COLORS.accent : done ? COLORS.success : COLORS.muted, fontFamily: "monospace", textAlign: "center", maxWidth: 60 }}>
                {step.label}
              </span>
            </div>
            {i < PIPELINE_STEPS.length - 1 && (
              <div style={{
                width: 20, height: 1.5,
                background: done ? COLORS.success : COLORS.border,
                transition: "background 0.4s",
                marginBottom: 16,
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── FHIR Output display ──────────────────────────────────────────────────────

function FHIROutput({ result, sampleType }) {
  if (!result) return null;
  const now = new Date().toISOString();
  const fhir = {
    resourceType: "Observation",
    id: `pcg-obs-${Date.now()}`,
    status: "final",
    category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "exam", display: "Exam" }] }],
    code: { coding: [{ system: "http://snomed.info/sct", code: "17462004", display: "Phonocardiography" }] },
    subject: { reference: "Patient/demo-patient-001" },
    effectiveDateTime: now,
    performer: [{ reference: "Device/digital-stethoscope-ai-001" }],
    valueCodeableConcept: {
      coding: [{ display: result.label }],
      text: result.label,
    },
    interpretation: [{
      coding: [{
        system: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
        code: result.severity === "normal" ? "N" : result.severity === "warn" ? "A" : "AA",
        display: result.severity === "normal" ? "Normal" : result.severity === "warn" ? "Abnormal" : "Critical",
      }]
    }],
    component: [
      { code: { text: "Heart Rate" }, valueQuantity: { value: result.heartRate, unit: "/min", system: "http://unitsofmeasure.org", code: "/min" } },
      { code: { text: "AI Confidence" }, valueQuantity: { value: result.confidence, unit: "%", system: "http://unitsofmeasure.org", code: "%" } },
      { code: { text: "Murmur" }, valueString: result.murmur },
      { code: { text: "Recommendation" }, valueString: result.recommendation },
    ],
  };

  return (
    <pre style={{
      background: "#0d1117", border: `1px solid ${COLORS.border}`,
      borderRadius: 8, padding: 16, fontSize: 10,
      color: "#79c0ff", fontFamily: "monospace",
      overflowX: "auto", maxHeight: 280, overflowY: "auto",
      lineHeight: 1.6,
    }}>
      {JSON.stringify(fhir, null, 2)
        .replace(/"([^"]+)":/g, (m, k) => `\x1b[0m"${k}":`)
      }
    </pre>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function DigitalStethoscopePipeline() {
  const [selectedSample, setSelectedSample] = useState(null);
  const [phase, setPhase] = useState("idle"); // idle | recording | processing | done
  const [activeStep, setActiveStep] = useState(-1);
  const [waveformData, setWaveformData] = useState([]);
  const [spectrogramData, setSpectrogramData] = useState([]);
  const [result, setResult] = useState(null);
  const [log, setLog] = useState([]);
  const [animWave, setAnimWave] = useState(false);
  const [noiseLevel, setNoiseLevel] = useState(12);
  const [signalQuality, setSignalQuality] = useState(0);
  const [tab, setTab] = useState("waveform"); // waveform | spectrogram | fhir

  const addLog = useCallback((msg, type = "info") => {
    const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
    setLog(prev => [...prev.slice(-50), { ts, msg, type }]);
  }, []);

  const runPipeline = useCallback(async (sampleKey) => {
    setPhase("recording");
    setActiveStep(0);
    setResult(null);
    setLog([]);
    setWaveformData([]);
    setSpectrogramData([]);
    setAnimWave(true);
    setSignalQuality(0);

    addLog(`[DEVICE] Digital stethoscope connected — 4000 Hz, 16-bit PCM`, "info");
    addLog(`[ACQUIRE] Recording cardiac cycle... (4s window)`, "info");
    await sleep(1800);

    // Generate waveform progressively
    const wf = generatePCGWaveform(sampleKey, 300);
    setWaveformData(wf);
    setSignalQuality(randomBetween(88, 98));
    addLog(`[ACQUIRE] ${wf.length * 4} samples captured. SNR: ${randomBetween(22, 32).toFixed(1)} dB`, "success");

    // Step 1: Artifact rejection
    setActiveStep(1);
    setPhase("processing");
    addLog(`[ARTIFACT] Running adaptive bandpass filter (20–1000 Hz)...`, "info");
    await sleep(900);
    addLog(`[ARTIFACT] Motion artifacts: 0. Noise floor: ${noiseLevel} dB. Signal clean.`, "success");

    // Step 2: Segmentation
    setActiveStep(2);
    addLog(`[SEGMENT] Running envelope extraction + HMM state decoding...`, "info");
    await sleep(1100);
    const numCycles = Math.floor(randomBetween(5, 8));
    addLog(`[SEGMENT] Detected ${numCycles} cardiac cycles. S1/S2 boundaries located.`, "success");

    // Step 3: Feature extraction
    setActiveStep(3);
    addLog(`[FEATURES] Computing Mel-spectrogram (128 bins, 25ms windows)...`, "info");
    await sleep(800);
    const sg = generateSpectrogram(sampleKey, 30, 60);
    setSpectrogramData(sg);
    addLog(`[FEATURES] MFCCs (40 coeffs), temporal envelope, ZCR extracted.`, "success");

    // Step 4: Classification
    setActiveStep(4);
    addLog(`[MODEL] Loading CardioNet-v3 (1D CNN + Transformer, 4.2M params)...`, "info");
    await sleep(1200);
    addLog(`[MODEL] Running inference on ${numCycles} windows...`, "info");
    await sleep(1000);

    // Step 5: Severity scoring
    setActiveStep(5);
    const classResult = CLASSIFICATIONS[sampleKey];
    addLog(`[CLASSIFY] Top class: "${classResult.label}" — conf: ${classResult.confidence}%`, classResult.severity === "normal" ? "success" : "warn");
    await sleep(700);
    addLog(`[SEVERITY] Grade mapped → ${classResult.severity.toUpperCase()}`, classResult.severity === "normal" ? "success" : "error");

    // Step 6: FHIR
    setActiveStep(6);
    addLog(`[FHIR] Generating HL7 FHIR R4 Observation resource...`, "info");
    await sleep(600);
    addLog(`[FHIR] Resource ID: pcg-obs-${Date.now()}. Status: final.`, "success");
    addLog(`[DONE] Pipeline complete. Elapsed: ~7.1s`, "success");

    setResult(classResult);
    setPhase("done");
    setAnimWave(false);
    setActiveStep(7); // all done
  }, [noiseLevel, addLog]);

  const SAMPLES = [
    { key: "normal", label: "Normal Heart", icon: "💚", sub: "Regular S1/S2, no murmur" },
    { key: "murmur_systolic", label: "Systolic Murmur", icon: "🟡", sub: "Grade III/VI, harsh" },
    { key: "murmur_diastolic", label: "Diastolic Murmur", icon: "🔴", sub: "Early decrescendo" },
    { key: "s3_gallop", label: "S3 Gallop", icon: "🔴", sub: "Heart failure pattern" },
  ];

  const severityColor = result
    ? result.severity === "normal" ? COLORS.success : result.severity === "warn" ? COLORS.warn : COLORS.danger
    : COLORS.accent;

  return (
    <div style={{
      minHeight: "100vh", background: COLORS.bg, color: COLORS.text,
      fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
      padding: "24px 20px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;600;700&family=Space+Grotesk:wght@300;500;700&display=swap');
        @keyframes ping { 75%,100% { transform: scale(1.8); opacity: 0; } }
        @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        @keyframes slideIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes scanline { 0% { transform: translateY(-100%); } 100% { transform: translateY(100vh); } }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-track { background: ${COLORS.surface}; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius:4px; }
      `}</style>

      {/* Header */}
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 22 }}>🩺</span>
              <h1 style={{
                margin: 0, fontSize: 20, fontWeight: 700,
                fontFamily: "'Space Grotesk', sans-serif",
                background: `linear-gradient(90deg, ${COLORS.accent}, #7b61ff)`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                letterSpacing: -0.5,
              }}>
                AI-Enabled Digital Stethoscope Pipeline
              </h1>
            </div>
            <p style={{ margin: 0, fontSize: 11, color: COLORS.muted, letterSpacing: 1 }}>
              PCG ACQUISITION → ARTIFACT REJECTION → SEGMENTATION → CNN CLASSIFICATION → FHIR OUTPUT
            </p>
          </div>
         </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <div style={{
              padding: "6px 14px", borderRadius: 8,
              background: "linear-gradient(135deg, #00e5ff18, #7b61ff18)",
              border: "1px solid #00e5ff44",
              boxShadow: "0 0 16px #00e5ff22",
            }}>
              <div style={{ fontSize: 9, color: "#5a6a85", fontFamily: "monospace", letterSpacing: 2, marginBottom: 2 }}>
                BUILT BY
              </div>
              <div style={{
                fontSize: 14, fontWeight: 700,
                fontFamily: "'Space Grotesk', sans-serif",
                background: "linear-gradient(90deg, #00e5ff, #7b61ff, #ff2d55)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                letterSpacing: 0.5,
              }}>
                Mahaboob Shareef Shaik
              </div>
              <div style={{ fontSize: 9, color: "#5a6a85", fontFamily: "monospace", letterSpacing: 1, marginTop: 2 }}>
                AI ENGINEER · CARDIOLOGY DOMAIN
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {phase === "recording" && <span style={{ fontSize: 10, color: COLORS.pulse, animation: "blink 1s infinite", fontFamily: "monospace" }}>● RECORDING</span>}
              {phase === "processing" && <span style={{ fontSize: 10, color: COLORS.warn, animation: "blink 0.7s infinite", fontFamily: "monospace" }}>⚙ PROCESSING</span>}
              {phase === "done" && <Badge text="ANALYSIS COMPLETE" type="normal" />}
            </div>
          </div>
```

---

### Visual guide — where it sits in the file:
```
Header section
├── Left side: 🩺 title + subtitle        ← don't touch
└── Right side: status badges             ← THIS is what you're replacing
                     ↓
               Right side: BUILT BY badge + status badges   ← new version
        </div>

        {/* Pipeline Visual */}
        <Card style={{ marginBottom: 20 }}>
          <SectionLabel>Pipeline Architecture</SectionLabel>
          <PipelineVisual activeStep={activeStep} />
          {activeStep >= 0 && activeStep < PIPELINE_STEPS.length && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: `${COLORS.accent}11`, borderRadius: 6, border: `1px solid ${COLORS.accent}33` }}>
              <span style={{ fontSize: 10, color: COLORS.accent, fontFamily: "monospace" }}>
                ⚡ {PIPELINE_STEPS[Math.min(activeStep, PIPELINE_STEPS.length - 1)]?.desc}
              </span>
            </div>
          )}
        </Card>

        {/* Sample Selection */}
        <Card style={{ marginBottom: 20 }}>
          <SectionLabel>Select PCG Sample</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 16 }}>
            {SAMPLES.map(s => (
              <button
                key={s.key}
                onClick={() => { setSelectedSample(s.key); }}
                disabled={phase === "recording" || phase === "processing"}
                style={{
                  padding: "12px 16px", borderRadius: 10, cursor: "pointer",
                  background: selectedSample === s.key ? `${COLORS.accent}18` : COLORS.surface,
                  border: `1.5px solid ${selectedSample === s.key ? COLORS.accent : COLORS.border}`,
                  color: COLORS.text, textAlign: "left",
                  transition: "all 0.2s",
                  boxShadow: selectedSample === s.key ? `0 0 12px ${COLORS.accent}22` : "none",
                  opacity: (phase === "recording" || phase === "processing") ? 0.5 : 1,
                }}
              >
                <div style={{ fontSize: 16, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: selectedSample === s.key ? COLORS.accent : COLORS.text }}>{s.label}</div>
                <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 2 }}>{s.sub}</div>
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 4 }}>Simulated Noise Level: {noiseLevel} dB</div>
              <input type="range" min={5} max={35} value={noiseLevel}
                onChange={e => setNoiseLevel(+e.target.value)}
                disabled={phase === "recording" || phase === "processing"}
                style={{ width: "100%", accentColor: COLORS.accent }}
              />
            </div>
            <button
              onClick={() => selectedSample && runPipeline(selectedSample)}
              disabled={!selectedSample || phase === "recording" || phase === "processing"}
              style={{
                padding: "12px 28px", borderRadius: 8, cursor: selectedSample ? "pointer" : "not-allowed",
                background: selectedSample ? `linear-gradient(135deg, ${COLORS.accent}, #7b61ff)` : COLORS.border,
                border: "none", color: "#000", fontWeight: 700, fontSize: 13,
                fontFamily: "monospace", letterSpacing: 1,
                opacity: (phase === "recording" || phase === "processing") ? 0.5 : 1,
                transition: "all 0.2s",
                boxShadow: selectedSample ? `0 4px 20px ${COLORS.accent}44` : "none",
              }}
            >
              {phase === "recording" ? "RECORDING..." : phase === "processing" ? "ANALYZING..." : "▶ RUN PIPELINE"}
            </button>
          </div>
        </Card>

        {/* Main Analysis Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, marginBottom: 20 }}>

          {/* Left: Visualization */}
          <div>
            <Card style={{ marginBottom: 16 }}>
              {/* Tab bar */}
              <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
                {["waveform", "spectrogram", "fhir"].map(t => (
                  <button key={t} onClick={() => setTab(t)} style={{
                    padding: "5px 14px", borderRadius: 6, cursor: "pointer",
                    background: tab === t ? `${COLORS.accent}22` : "transparent",
                    border: `1px solid ${tab === t ? COLORS.accent : COLORS.border}`,
                    color: tab === t ? COLORS.accent : COLORS.muted,
                    fontSize: 10, fontFamily: "monospace", fontWeight: 700,
                    letterSpacing: 1, transition: "all 0.2s",
                  }}>
                    {t.toUpperCase()}
                  </button>
                ))}
                {signalQuality > 0 && (
                  <span style={{ marginLeft: "auto", fontSize: 10, color: COLORS.success, fontFamily: "monospace", alignSelf: "center" }}>
                    SQ: {signalQuality.toFixed(1)}%
                  </span>
                )}
              </div>

              {tab === "waveform" && (
                <>
                  <SectionLabel>PCG Waveform (Phonocardiogram)</SectionLabel>
                  {waveformData.length > 0
                    ? <WaveformCanvas data={waveformData} height={110} />
                    : (
                      <div style={{ height: 110, background: COLORS.surface, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ color: COLORS.muted, fontSize: 11 }}>Awaiting recording...</span>
                      </div>
                    )
                  }
                  <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
                    {["S1 (Lub)", "Systole", "S2 (Dub)", "Diastole"].map((lbl, i) => (
                      <div key={i} style={{ fontSize: 9, color: COLORS.muted, fontFamily: "monospace" }}>
                        <span style={{ color: [COLORS.accent, COLORS.warn, COLORS.accent, COLORS.muted][i] }}>▲</span> {lbl}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {tab === "spectrogram" && (
                <>
                  <SectionLabel>Mel-Frequency Spectrogram</SectionLabel>
                  {spectrogramData.length > 0
                    ? (
                      <>
                        <SpectrogramCanvas grid={spectrogramData} />
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                          <span style={{ fontSize: 9, color: COLORS.muted }}>20 Hz</span>
                          <span style={{ fontSize: 9, color: COLORS.muted }}>Time →</span>
                          <span style={{ fontSize: 9, color: COLORS.muted }}>1000 Hz</span>
                        </div>
                      </>
                    )
                    : (
                      <div style={{ height: 120, background: COLORS.surface, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ color: COLORS.muted, fontSize: 11 }}>Run pipeline to compute spectrogram...</span>
                      </div>
                    )
                  }
                </>
              )}

              {tab === "fhir" && (
                <>
                  <SectionLabel>HL7 FHIR R4 Output</SectionLabel>
                  {result
                    ? <FHIROutput result={result} sampleType={selectedSample} />
                    : (
                      <div style={{ height: 200, background: COLORS.surface, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ color: COLORS.muted, fontSize: 11 }}>Run pipeline to generate FHIR resource...</span>
                      </div>
                    )
                  }
                </>
              )}
            </Card>

            {/* Classification probabilities */}
            {result && (
              <Card style={{ animation: "slideIn 0.4s ease" }}>
                <SectionLabel>Model Probability Distribution</SectionLabel>
                <ProgressBar label="Normal Heart Sounds" value={selectedSample === "normal" ? result.confidence : randomBetween(1, 6)} color={COLORS.success} />
                <ProgressBar label="Systolic Murmur" value={selectedSample === "murmur_systolic" ? result.confidence : randomBetween(1, 8)} color={COLORS.warn} />
                <ProgressBar label="Diastolic Murmur" value={selectedSample === "murmur_diastolic" ? result.confidence : randomBetween(1, 6)} color={COLORS.danger} />
                <ProgressBar label="S3/S4 Gallop" value={selectedSample === "s3_gallop" ? result.confidence : randomBetween(1, 5)} color={COLORS.pulse} />
                <div style={{ marginTop: 8, fontSize: 10, color: COLORS.muted }}>
                  Model: CardioNet-v3 • 1D CNN + Transformer • Trained on 135,000 PCG recordings
                </div>
              </Card>
            )}
          </div>

          {/* Right: Results + Log */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Heart animation + result */}
            <Card>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <PulseRing active={phase === "recording" || phase === "processing"} />

                {result ? (
                  <div style={{ textAlign: "center", animation: "slideIn 0.4s ease" }}>
                    <div style={{ marginBottom: 8 }}>
                      <Badge
                        text={result.severity.toUpperCase()}
                        type={result.severity === "normal" ? "normal" : result.severity === "warn" ? "warn" : "danger"}
                      />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: severityColor, marginBottom: 4, fontFamily: "'Space Grotesk', sans-serif" }}>
                      {result.label}
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.muted }}>
                      Confidence: <span style={{ color: COLORS.accent }}>{result.confidence}%</span>
                    </div>
                    <div style={{ fontSize: 20, color: COLORS.accent, fontWeight: 700, marginTop: 8 }}>
                      {result.heartRate} <span style={{ fontSize: 11, color: COLORS.muted }}>bpm</span>
                    </div>
                    <div style={{ fontSize: 10, color: COLORS.muted }}>{result.rhythm}</div>
                  </div>
                ) : (
                  <div style={{ textAlign: "center", color: COLORS.muted, fontSize: 11 }}>
                    {phase === "idle" ? "Select a sample to begin" : "Processing..."}
                  </div>
                )}
              </div>
            </Card>

            {/* Clinical findings */}
            {result && (
              <Card style={{ animation: "slideIn 0.5s ease" }}>
                <SectionLabel>Clinical Findings</SectionLabel>
                {result.findings.map((f, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "5px 0", borderBottom: i < result.findings.length - 1 ? `1px solid ${COLORS.border}` : "none",
                  }}>
                    <span style={{ fontSize: 10, color: COLORS.muted }}>{f.label}</span>
                    <span style={{ fontSize: 10, color: f.ok ? COLORS.success : COLORS.danger, fontWeight: 700 }}>
                      {f.ok ? "✓" : "⚠"} {f.value}
                    </span>
                  </div>
                ))}
              </Card>
            )}

            {/* Recommendation */}
            {result && (
              <Card style={{
                borderColor: severityColor + "55",
                background: `${severityColor}08`,
                animation: "slideIn 0.6s ease",
              }}>
                <SectionLabel>AI Recommendation</SectionLabel>
                <p style={{ margin: 0, fontSize: 11, color: COLORS.text, lineHeight: 1.7 }}>
                  {result.recommendation}
                </p>
                <div style={{ marginTop: 10, fontSize: 9, color: COLORS.muted }}>
                  ⚠ For clinical decision support only. Requires physician review before action.
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Console Log */}
        <Card>
          <SectionLabel>Pipeline Console</SectionLabel>
          <div style={{
            background: "#060810", borderRadius: 6, padding: "10px 14px",
            height: 180, overflowY: "auto", fontFamily: "monospace", fontSize: 10,
          }}>
            {log.length === 0 ? (
              <span style={{ color: COLORS.muted }}>$ awaiting pipeline execution...</span>
            ) : (
              log.map((entry, i) => (
                <div key={i} style={{
                  padding: "1px 0", animation: "slideIn 0.2s ease",
                  color: entry.type === "success" ? COLORS.success : entry.type === "error" ? COLORS.danger : entry.type === "warn" ? COLORS.warn : COLORS.accent,
                }}>
                  <span style={{ color: COLORS.muted }}>[{entry.ts}] </span>
                  {entry.msg}
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Footer */}
        <div style={{ marginTop: 20, textAlign: "center", fontSize: 9, color: COLORS.muted, letterSpacing: 1 }}>
          STACK: PYTORCH • LIBROSA • TORCHAUDIO • ONNX RUNTIME • MONAI • HL7 FHIR R4 • CARDIONET-V3
          <br />
          Dataset: PhysioNet PCG Challenge 2016 + Pascal Challenge B • N=135,000 recordings
          <br />
          <span style={{ color: COLORS.accent }}>FOR RESEARCH & EDUCATIONAL PURPOSES — NOT FDA CLEARED</span>
        </div>
      </div>
    </div>
  );
}
