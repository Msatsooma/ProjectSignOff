// Satsooma Sign-off: checklist definitions
//
// Each checklist appears as a button on the home screen. To add or reword
// questions, edit this file, then bump VERSION in sw.js so phones pick it up.
//
// draft: true shows a "Trial version: questions may still be adjusted" note in
// the app and on the PDF. Set it to false once the checklist has settled.
//
// Keep each item id unique and unchanged once in use: the data file Claude
// reads uses these ids to file answers against the job.
//
// An item can also have boxes for the installer to write readings in, e.g.
//   fields: [{ id: 'flow-temp', label: 'Design flow temp', unit: '°C' }]
//   unit: 'xx'          fixed unit shown after the box
//   units: ['a', 'b']   installer picks the unit (first one is the default)
//   signed: true        allow minus figures (gives the full keyboard on phones)
//   text: true          words rather than a number
// Readings are optional and print on the PDF under the check.
//
// choices: [{ key, label }, ...] replaces Yes / No / N/A with your own answers
// for that check (e.g. which frost protection was used).
//
// photo: 'Caption' gives a check its own "Take photo" button. If the check is
// answered Yes, the photo is required; it prints on the PDF with that caption.

const CHECKLISTS = [
  {
    id: 'install-signoff',
    version: 'draft-8',
    draft: true,
    name: 'Installation sign-off',
    fileLabel: 'Install-signoff',
    blurb: 'End-of-installation checks and customer sign-off',
    engineerDeclaration: 'I confirm the work above has been completed and checked as recorded.',
    // The customer signs only these points, on their own card, not the technical checks.
    customerAcknowledgements: [
      'I have been shown how to use my heating and hot water controls',
      'The app has been set up for me',
      'I understand my heat pump needs servicing every year to keep the warranty valid',
      'I understand my handover pack will be emailed to me within 14 days'
    ],
    customerDeclaration: 'By signing, I confirm the points above.',
    customerNote: 'The technical checks in this report are recorded and signed off by the installer.',
    sections: [
      {
        title: 'Outdoor unit',
        items: [
          { id: 'hp-sited', text: 'Heat pump sited as agreed, level and secure on its base or feet' },
          { id: 'hp-clearances', text: "Clearances around the unit meet the manufacturer's instructions" },
          { id: 'condensate', text: 'Condensate drains away safely' },
          { id: 'hp-id-photo', text: "Photo taken of the outdoor unit's ID / serial number label (for the warranty)", photo: 'Outdoor unit ID / serial label' },
          { id: 'ext-pipework', text: 'External pipework insulated and weatherproofed' }
        ]
      },
      {
        title: 'System and cylinder',
        items: [
          { id: 'flushed', text: 'System flushed and cleaned' },
          { id: 'pressure-tested', text: 'System pressure tested and free of leaks' },
          {
            id: 'frost-protection-type', text: 'Frost protection?',
            choices: [
              { key: 'glycol', label: 'Glycol' },
              { key: 'anti-freeze-valves', label: 'Anti-freeze valves' },
              { key: 'not-required', label: 'Not required' }
            ]
          },
          { id: 'cylinder-discharge', text: 'Unvented cylinder discharge pipework and tundish installed correctly' },
          { id: 'emitters-balanced', text: 'Radiators / emitters balanced' }
        ]
      },
      {
        title: 'Electrics and controls',
        items: [
          { id: 'electrics-complete', text: 'Electrical work complete and isolator fitted' },
          { id: 'controls-set', text: 'Controls and sensors installed and set up' },
          {
            id: 'room-stat', text: 'Room thermostat / room influence installed?',
            // Own Yes / No so a "No" (weather compensation only) doesn't demand a note
            choices: [
              { key: 'yes', label: 'Yes' },
              { key: 'none', label: 'No' }
            ]
          }
        ]
      },
      {
        title: 'Commissioning',
        items: [
          { id: 'commissioned', text: 'Heat pump commissioned' },
          {
            id: 'heat-curve', text: 'Flow temperature / heat curve set',
            fields: [
              { id: 'flow-temp', label: 'Design flow temp', unit: '°C' },
              { id: 'outside-temp', label: 'At outside temp', unit: '°C', signed: true },
              { id: 'slope', label: 'Heat curve slope' },
              { id: 'level', label: 'Heat curve level', signed: true }
            ]
          },
          {
            id: 'flow-rate', text: 'Flow rate checked',
            fields: [{ id: 'flow-rate', label: 'Flow rate', units: ['l/h', 'l/min'] }]
          },
          {
            id: 'dhw-temp', text: 'Hot water set temperature set',
            fields: [{ id: 'dhw-temp', label: 'Hot water set temp', unit: '°C' }]
          },
          { id: 'dhw-programme', text: 'Hot water programme set' },
          {
            id: 'legionella', text: 'Legionella cycle set',
            fields: [
              { id: 'temp', label: 'Cycle temp', unit: '°C' },
              { id: 'day', label: 'Day / frequency', text: true }
            ]
          },
          { id: 'ch-programme', text: 'Central heating programme set' }
        ]
      },
      {
        title: 'Handover',
        items: [
          { id: 'customer-shown', text: 'Customer shown how to use the controls' },
          { id: 'internet-connected', text: 'Unit connected to the internet' },
          { id: 'remote-access', text: 'Remote access set up for the installer' },
          { id: 'customer-app', text: 'App set up for the customer' },
          { id: 'annual-maintenance', text: 'Annual maintenance explained: it is essential to keep the warranty valid' },
          { id: 'handover-pack-email', text: 'Customer told their handover pack will be emailed within 14 days' },
          { id: 'site-tidy', text: 'Site left clean and tidy, waste removed' }
        ]
      }
    ]
  }
];
