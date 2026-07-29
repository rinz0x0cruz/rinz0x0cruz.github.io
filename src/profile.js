export default {
  name: 'Mohit Sharma',
  eyebrow: 'Identity / Security research',
  position: 'Security Researcher',
  company: {
    name: 'Microsoft',
    mark: ['#f25022', '#7fba00', '#00a4ef', '#ffb900'],
  },
  // a status readout, not a control: flip `open` to change what the card shows
  availability: {
    open: false,
    employedLabel: 'Employed',
    openLabel: 'Open to offers',
  },
  disciplines: [
    { abbr: 'TI', name: 'Threat intelligence', detail: 'Hunt reporting · OSINT · ATT&CK' },
    { abbr: 'GRC', name: 'Governance, risk & compliance', detail: 'ISO 27001/42001 LA · CIS controls' },
    { abbr: 'VM', name: 'Vulnerability management', detail: 'CVE triage · exploitability' },
  ],
  quotes: [
    'Keeping good guys a step ahead',
    'Making bad guys shed tears',
    'Tearing apart that one malware',
    "They won't know what hit 'em when I'm around",
    'Making some beaten coffee',
    'Wait... What tab was that email again?',
    'We got intruder? Hold my Wireshark...',
    'Swimming in your network like a barracuda!',
    "What do you mean it's Sunday already?!",
  ],
  links: [
    {
      label: 'Résumé',
      detail: 'Experience record',
      href: 'https://rinz0x0cruz.github.io/Mohit-Sharma-Resume.pdf',
      external: true,
    },
    {
      label: 'GitHub',
      detail: 'Source / systems',
      href: 'https://github.com/rinz0x0cruz',
      external: true,
    },
    {
      label: 'LinkedIn',
      detail: 'Professional network',
      href: 'https://www.linkedin.com/in/rinz0x0cruz/',
      external: true,
    },
    {
      label: 'Email',
      detail: 'Direct channel',
      href: 'mailto:rinz0x0cruz@gmail.com',
      external: false,
    },
  ],
  achievements: [
    {
      metric: '100+',
      title: 'Incidents & CVEs triaged',
      detail: 'Copy Fail · Dirty Frag · Shai-Hulud',
      motif: 'orbit',
      glyph: '◇',
      accent: '#d1a35f',
      instrument: {
        src: '/models/industrial_microscope/industrial_microscope.glb',
        rotation: [-0.12, -0.42, 0],
      },
    },
    {
      metric: 'GA',
      title: 'Shipped Security Config',
      detail: 'Remote Registry · 1M+ customers',
      motif: 'stack',
      glyph: '⌗',
      accent: '#7d8fa2',
      instrument: {
        src: '/models/retro_multimeter/retro_multimeter.glb',
        rotation: [-0.1, 0.42, 0],
      },
    },
    {
      metric: '47%',
      title: 'Fewer false positives',
      detail: '9 of 10 ingestion specs · 10+ products',
      motif: 'prism',
      glyph: '△',
      accent: '#c0604c',
      instrument: {
        src: '/models/vintage_spacecraft_instrument/vintage_spacecraft_instrument.glb',
        rotation: [-0.08, -0.4, 0],
      },
    },
    {
      metric: '05D',
      title: 'STORM-2230 hunt report',
      detail: 'KQL · endpoint + identity evidence',
      motif: 'signal',
      glyph: '⌁',
      accent: '#a7a39b',
      instrument: {
        src: '/models/signal_flashlight/signal_flashlight.glb',
        rotation: [0.1, -0.55, -0.14],
      },
    },
  ],
}