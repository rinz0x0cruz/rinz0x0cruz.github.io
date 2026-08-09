import { resumeHref } from './identity.js'

export default [
  {
    id: 'incidents-cves-triaged',
    metric: '100+',
    title: 'Incidents + CVEs triaged',
    detail: 'Exploitability · root cause · coverage gaps',
    evidenceLabel: 'CVE triage in résumé',
    evidenceHref: resumeHref,
    motif: 'orbit',
    glyph: '◇',
    accent: '#d1a35f',
    instrument: {
      src: '/models/industrial_microscope/industrial_microscope.glb',
      rotation: [-0.12, -0.42, 0],
    },
  },
  {
    id: 'shipped-security-config',
    metric: 'GA',
    title: 'Remote Registry config',
    detail: 'Windows 7–11 · Server 2016+',
    evidenceLabel: 'Control launch in résumé',
    evidenceHref: resumeHref,
    motif: 'stack',
    glyph: '⌗',
    accent: '#7d8fa2',
    instrument: {
      src: '/models/retro_multimeter/retro_multimeter.glb',
      rotation: [-0.1, 0.42, 0],
    },
  },
  {
    id: 'ingestion-specs-authored',
    metric: '47%',
    title: 'False positives reduced',
    detail: 'Across 10+ security products',
    evidenceLabel: 'Quality result in résumé',
    evidenceHref: resumeHref,
    motif: 'prism',
    glyph: '△',
    accent: '#c0604c',
    instrument: {
      src: '/models/vintage_spacecraft_instrument/vintage_spacecraft_instrument.glb',
      rotation: [-0.08, -0.4, 0],
    },
  },
  {
    id: 'storm-2230-hunt-report',
    metric: '5 days',
    title: 'STORM-2230 hunt report',
    detail: 'Ransomware · endpoint + identity KQL',
    evidenceLabel: 'Hunt report in résumé',
    evidenceHref: resumeHref,
    motif: 'signal',
    glyph: '⌁',
    accent: '#a7a39b',
    instrument: {
      src: '/models/signal_flashlight/signal_flashlight.glb',
      rotation: [0.1, -0.55, -0.14],
    },
  },
]