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
  ,
  {
    id: 'service-report',
    version: 'draft-1',
    draft: true,
    name: 'Service report',
    fileLabel: 'Service-report',
    blurb: 'Annual heat pump service checks and customer report',
    // Service jobs don't have a fixed reference structure yet, so the reference is optional and any format is accepted.
    jobRef: {
      required: false,
      strict: false,
      label: 'Job reference (if there is one)',
      placeholder: 'SERV-2026-09-502',
      help: 'Use the SERV reference if you have it. Otherwise leave blank: the address below identifies the job.'
    },
    headerFields: [
      { id: 'address', label: 'Address or postcode', pdfLabel: 'Address', help: 'Optional, but helps the office match the report to the customer' }
    ],
    // Customer-facing summaries. They print near the top of the PDF, before the detailed checks.
    textBlocks: [
      { id: 'work-done', title: 'Work carried out', label: 'A short summary for the customer of what was done', placeholder: 'e.g. Cleaned the outdoor unit and checked the system over. Everything working well.', required: true },
      { id: 'recommendations', title: 'Recommendations', label: 'Anything the customer should know about or consider (performance, repairs, improvements). Leave blank if none.', emptyText: 'No recommendations at this visit.' }
    ],
    // Office-only notes: kept in the data file, not printed on the customer's PDF.
    officeNotes: {
      title: 'Notes for the office',
      label: 'Office only, not shown on the customer report: parts to order, quotes to send, return visits',
      placeholder: 'Leave blank if nothing to follow up',
      onPdf: false
    },
    signOffTitle: 'Engineer sign-off',
    engineerDeclaration: 'I confirm the service work above has been carried out and checked as recorded.',
    customerAcknowledgements: [
      'The engineer has talked me through the work carried out and any recommendations',
      'I understand my heat pump should be serviced again in about 12 months'
    ],
    customerDeclaration: 'By signing, I confirm the points above.',
    customerNote: 'The technical checks in this report are recorded and signed off by the engineer.',
    sections: [
      {
        title: 'Equipment',
        items: [
          {
            id: 'equipment', text: 'Heat pump details recorded',
            fields: [
              { id: 'make-model', label: 'Outdoor unit make and model', text: true },
              { id: 'outdoor-serial', label: 'Outdoor unit serial number', text: true },
              { id: 'indoor-model', label: 'Indoor unit / cylinder model', text: true },
              { id: 'indoor-serial', label: 'Indoor unit serial number', text: true }
            ]
          },
          { id: 'id-photo', text: "Photo taken of the outdoor unit's ID / serial number label", photo: 'Outdoor unit ID / serial label' }
        ]
      },
      {
        title: 'Outdoor unit',
        items: [
          { id: 'od-debris', text: 'Debris and leaves cleared from around and inside the unit' },
          { id: 'od-fan-hx', text: 'Fan and heat exchanger cleaned and inspected' },
          { id: 'od-condensate', text: 'Condensate drains away freely' },
          { id: 'od-mounting', text: 'Base or feet secure, anti-vibration mounts in good condition' },
          { id: 'od-insulation', text: 'External pipework insulation intact (photo it if not)' },
          { id: 'od-wear', text: 'Visual check for any signs of wear or damage' }
        ]
      },
      {
        title: 'System and indoor plant',
        items: [
          {
            id: 'sys-pressure', text: 'System pressure checked and topped up if needed',
            fields: [
              { id: 'before', label: 'Pressure before', unit: 'bar' },
              { id: 'after', label: 'Pressure after', unit: 'bar' }
            ]
          },
          {
            id: 'vessels', text: 'Expansion vessels checked and re-charged',
            fields: [
              { id: 'heating', label: 'Heating vessel charge', unit: 'bar' },
              { id: 'dhw', label: 'Hot water vessel charge', unit: 'bar' }
            ]
          },
          { id: 'strainer', text: 'Strainer / filter cleaned' },
          { id: 'frost-valves', text: 'Anti-freeze valves checked' },
          { id: 'leaks', text: 'Visual check for leaks on the cylinder and pipework' },
          { id: 'pump', text: 'Circulating pump working' },
          { id: 'cyl-valves', text: 'Unvented cylinder: pressure relief and temperature / pressure relief valves operated by hand' },
          { id: 'cyl-discharge', text: 'Unvented cylinder: tundish and discharge pipework clear and in good condition' }
        ]
      },
      {
        title: 'Electrics and controls',
        items: [
          { id: 'elec-visual', text: 'Visual check of electrical connections and isolator' },
          {
            id: 'fault-history', text: 'Fault history checked',
            fields: [{ id: 'codes', label: 'Fault codes found (if any)', text: true }]
          },
          { id: 'settings', text: 'Settings and set-up checked' }
        ]
      },
      {
        title: 'Performance',
        items: [
          {
            id: 'heat-curve', text: 'Flow temperature / heat curve checked',
            fields: [
              { id: 'flow-temp', label: 'Design flow temp', unit: '°C' },
              { id: 'slope', label: 'Heat curve slope' },
              { id: 'level', label: 'Heat curve level', signed: true }
            ]
          },
          {
            id: 'flow-rate', text: 'Flow rate checked',
            fields: [{ id: 'flow-rate', label: 'Flow rate', units: ['l/h', 'l/min'] }]
          },
          {
            id: 'dhw-settings', text: 'Hot water and legionella settings checked',
            fields: [
              { id: 'dhw-temp', label: 'Hot water set temp', unit: '°C' },
              { id: 'legionella-temp', label: 'Legionella cycle temp', unit: '°C' }
            ]
          },
          {
            id: 'scop', text: 'System performance (SCOP) checked',
            fields: [
              { id: 'scop', label: 'SCOP' },
              { id: 'period', label: 'Period covered', text: true }
            ]
          }
        ]
      },
      {
        title: 'Finish',
        items: [
          { id: 'left-running', text: 'Heat pump left running normally' },
          { id: 'site-tidy', text: 'Site left clean and tidy' }
        ]
      }
    ]
  }
];
