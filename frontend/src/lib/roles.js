// Display labels for the underlying user_role enum. The DB enum stays stable;
// only the UI labels change. Easy upgrade path if you ever want hard separation.
export const ROLE_LABELS = {
  admin:   'Client Success Manager',
  manager: 'Analyst Manager',
  member:  'Analyst',
};

export const ROLE_OPTIONS = [
  { value: 'admin',   label: ROLE_LABELS.admin   },
  { value: 'manager', label: ROLE_LABELS.manager },
  { value: 'member',  label: ROLE_LABELS.member  },
];

export const labelFor = (role) => ROLE_LABELS[role] ?? role;
