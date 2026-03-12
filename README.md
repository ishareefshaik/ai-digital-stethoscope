# 🩺 AI-Enabled Digital Stethoscope Pipeline

> A production-grade cardiology AI demo — PCG acquisition → artifact rejection → cardiac segmentation → CNN classification → HL7 FHIR R4 output

**Live Demo:** `https://<your-username>.github.io/ai-digital-stethoscope/`

---

## 🎯 What This Demonstrates

A complete 7-step AI pipeline for cardiac auscultation analysis:

| Step | Component | Technology |
|------|-----------|------------|
| 1 | PCG Acquisition | 4000 Hz, 16-bit PCM simulation |
| 2 | Artifact Rejection | Adaptive bandpass filter (20–1000 Hz) |
| 3 | Cardiac Segmentation | HMM-based S1/S2 boundary detection |
| 4 | Feature Extraction | Mel-spectrogram + MFCCs (40 coeffs) |
| 5 | CNN Classification | CardioNet-v3 (1D CNN + Transformer) |
| 6 | Severity Scoring | Calibrated probability → clinical grade |
| 7 | FHIR Output | HL7 FHIR R4 Observation resource |

## 🫀 Supported Clinical Samples

- 💚 **Normal Heart Sounds** — Regular S1/S2, no murmur
- 🟡 **Systolic Murmur** — Grade III/VI, aortic stenosis pattern
- 🔴 **Diastolic Murmur** — Early decrescendo, aortic regurgitation
- 🔴 **S3 Gallop** — Heart failure signature

## 🛠 Tech Stack

- **Frontend:** React 18 + Vite
- **Visualization:** Canvas API (waveform + spectrogram)
- **Standards:** HL7 FHIR R4, SNOMED CT, LOINC
- **Deployment:** GitHub Pages via GitHub Actions

## 🚀 Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`

## 📦 Build & Deploy

```bash
npm run build   # outputs to /dist
```

Push to `main` branch → GitHub Actions auto-deploys to GitHub Pages.

---

> ⚠️ **Disclaimer:** For research and educational purposes only. Not FDA cleared. Not intended for clinical use.
