// Satsooma Sign-off: checklist definitions
//
// Each checklist appears as a button on the home screen. To add or reword
// questions, edit this file, then bump VERSION in sw.js so phones pick it up.
//
// draft: true prints a "TEST / DRAFT CHECKLIST" marker in the app and on the PDF.
// Set it to false once the wording is Satsooma's own.
//
// Keep each item id unique and unchanged once in use: the data file Claude
// reads uses these ids to file answers against the job.

const CHECKLISTS = [
  {
    id: 'install-signoff',
    version: 'draft-1',
    draft: true,
    name: 'Installation sign-off',
    fileLabel: 'Install-signoff',
    blurb: 'End-of-installation checks and customer sign-off',
    engineerDeclaration: 'I confirm the work above has been completed and checked as recorded.',
    customerDeclaration: 'I confirm the system has been explained to me and I have received the handover information.',
    sections: [
      {
        title: 'Outdoor unit',
        items: [
          { id: 'hp-sited', text: 'Heat pump sited as agreed, level and secure on its base or feet' },
          { id: 'hp-clearances', text: "Clearances around the unit meet the manufacturer's instructions" },
          { id: 'condensate', text: 'Condensate drains away safely' },
          { id: 'ext-pipework', text: 'External pipework insulated and weatherproofed' }
        ]
      },
      {
        title: 'System and cylinder',
        items: [
          { id: 'flushed', text: 'System flushed and cleaned' },
          { id: 'pressure-tested', text: 'System pressure tested and free of leaks' },
          { id: 'frost-protection', text: 'Frost protection in place (glycol or anti-freeze valves)' },
          { id: 'cylinder-discharge', text: 'Unvented cylinder discharge pipework and tundish installed correctly' },
          { id: 'emitters-balanced', text: 'Radiators / emitters balanced' }
        ]
      },
      {
        title: 'Electrics and controls',
        items: [
          { id: 'electrics-complete', text: 'Electrical work complete and isolator fitted' },
          { id: 'controls-set', text: 'Controls and sensors installed and set up' }
        ]
      },
      {
        title: 'Commissioning and handover',
        items: [
          { id: 'commissioned', text: 'Heat pump commissioned' },
          { id: 'customer-shown', text: 'Customer shown how to use the controls' },
          { id: 'handover-pack', text: 'Handover pack and manuals left with the customer' },
          { id: 'site-tidy', text: 'Site left clean and tidy, waste removed' }
        ]
      }
    ]
  }
];
