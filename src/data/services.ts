export const serviceGroups = [
  {
    id: 'cybersecurity', name: 'Cybersecurity', intro: 'Understand your risks. Give your team a clear plan.',
    services: [
      { name: 'Initial Technology & Security Assessment', included: 'A first look at your current technology and security setup to identify quick wins and bigger risks.', deliverable: 'Checklist + summary report', cost: 'FREE', note: 'Our starting point for every client' },
      { name: 'Compliance Assessment', included: 'A review of your organization against relevant compliance standards (for example HIPAA, the FTC Safeguards Rule, the NY SHIELD Act, NY Ed Law 2-d) to flag gaps before they become problems.', deliverable: 'Compliance summary report', cost: 'Free / low cost' },
      { name: 'Cybersecurity Risk Assessment', included: "An evaluation of your systems and practices to identify where you’re most exposed to cyber threats.", deliverable: 'Risk assessment report', cost: 'Free / low cost' },
      { name: 'Incident Response & Recovery Planning', included: 'A clear, step-by-step plan so your team knows exactly what to do if something goes wrong.', deliverable: 'Incident response playbook', cost: 'Free / low cost' },
      { name: 'Employee Cybersecurity Training & Awareness', included: 'In-person or online training to help your staff recognize and avoid common cyber threats.', deliverable: 'Training slides + videos', cost: 'Free / low cost' },
    ],
  },
  {
    id: 'technology', name: 'Technology', intro: 'Make everyday systems work better for the people using them.',
    services: [
      { name: 'Infrastructure & Cloud Design + AI', included: 'A review of your infrastructure and cloud setup, with recommendations for where AI can improve efficiency.', deliverable: 'Assessment checklist + report', cost: 'Free / low cost' },
      { name: 'Network & Device Health Check', included: 'A full check of your network and connected devices to catch issues before they cause downtime.', deliverable: 'Health check checklist + fixes', cost: 'Free / low cost' },
      { name: 'Software & Vendor Selection', included: 'Help evaluating and selecting the right software and vendors for your specific needs.', deliverable: 'Vendor comparison list with use cases', cost: 'Free / low cost' },
    ],
  },
  {
    id: 'software-development', name: 'Software development', intro: 'Create a better experience for your visitors and your team.',
    services: [
      { name: 'Website & App Usability Review', included: 'An expert review of your website or app from a visitor’s perspective, highlighting what’s working and what’s not.', deliverable: 'Usability report + recommendations', cost: 'Free / low cost' },
      { name: 'Website Build or Refresh', included: 'A full website build or redesign, handled by our team from start to finish. Hosting and infrastructure costs are covered by the client.', deliverable: 'A live, functioning website', cost: 'Free build; client pays hosting' },
      { name: 'Custom Application Development', included: 'Custom-built software or applications tailored to your organization’s specific workflows.', deliverable: 'A working custom application', cost: 'Paid engagement' },
    ],
  },
  {
    id: 'data-analytics', name: 'Data & analytics', intro: 'Turn scattered information into something you can use.',
    services: [
      { name: 'Data Cleanup & Organization', included: 'We organize and clean up messy spreadsheets and datasets so they’re easy to use and trust.', deliverable: 'Cleaned sample dataset + summary', cost: 'Free / low cost' },
      { name: 'Data Insights & Dashboarding', included: 'We turn your raw data into an easy-to-read dashboard so you can see what matters at a glance.', deliverable: 'Dashboard + insights report', cost: 'Free / low cost' },
      { name: 'Data Architecture Review', included: 'A review of how your data is structured and stored, with recommendations for improvement.', deliverable: 'Data architecture report + recommendations', cost: 'Free / low cost' },
    ],
  },
  {
    id: 'ai-enablement', name: 'AI enablement', intro: 'Find useful, practical ways to put new tools to work.',
    services: [
      { name: 'AI for Small Business Workshop', included: 'A hands-on workshop introducing your team to tools like ChatGPT, Claude and Gemini and how to use them effectively.', deliverable: 'Workshop slides + prompt library', cost: 'Free / low cost' },
      { name: 'Workflow Automation', included: 'We identify repetitive tasks and help automate them so your team can focus on higher-value work.', deliverable: 'Custom automation template pack', cost: 'Free / low cost' },
      { name: 'AI Model Customization', included: 'Guidance tailoring AI models to fit your organization’s specific needs.', deliverable: 'Customization guidelines + examples', cost: 'Free / low cost' },
    ],
  },
];
