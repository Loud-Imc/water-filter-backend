export const PERMISSION_MODULES = {
  CUSTOMERS: 'customers',
  SERVICES: 'services',
  USERS: 'users',
  REGIONS: 'regions',
  REPORTS: 'reports',
  DASHBOARD: 'dashboard',
} as const;

export const PERMISSION_ACTIONS = {
  VIEW: 'view',
  CREATE: 'create',
  EDIT: 'edit',
  DELETE: 'delete',
  APPROVE: 'approve',
  ASSIGN: 'assign',
  EXPORT: 'export',
} as const;

export interface Permission {
  module: string;
  action: string;
  key: string; // e.g., "customers.view"
  label: string;
  description: string;
}

export const ALL_PERMISSIONS: Permission[] = [
  // Customers
  {
    module: PERMISSION_MODULES.CUSTOMERS,
    action: PERMISSION_ACTIONS.VIEW,
    key: 'customers.view',
    label: 'View Customers',
    description: 'View customer list and details',
  },
  {
    module: PERMISSION_MODULES.CUSTOMERS,
    action: PERMISSION_ACTIONS.CREATE,
    key: 'customers.create',
    label: 'Create Customers',
    description: 'Add new customers',
  },
  {
    module: PERMISSION_MODULES.CUSTOMERS,
    action: PERMISSION_ACTIONS.EDIT,
    key: 'customers.edit',
    label: 'Edit Customers',
    description: 'Modify customer information',
  },
  {
    module: PERMISSION_MODULES.CUSTOMERS,
    action: PERMISSION_ACTIONS.DELETE,
    key: 'customers.delete',
    label: 'Delete Customers',
    description: 'Remove customers from system',
  },

  // Services
  {
    module: PERMISSION_MODULES.SERVICES,
    action: PERMISSION_ACTIONS.VIEW,
    key: 'services.view',
    label: 'View Services',
    description: 'View service requests',
  },
  {
    module: PERMISSION_MODULES.SERVICES,
    action: PERMISSION_ACTIONS.CREATE,
    key: 'services.create',
    label: 'Create Services',
    description: 'Create new service requests',
  },
  {
    module: PERMISSION_MODULES.SERVICES,
    action: PERMISSION_ACTIONS.EDIT,
    key: 'services.edit',
    label: 'Edit Services',
    description: 'Modify service requests',
  },
  {
    module: PERMISSION_MODULES.SERVICES,
    action: PERMISSION_ACTIONS.DELETE,
    key: 'services.delete',
    label: 'Delete Services',
    description: 'Delete service requests',
  },
  {
    module: PERMISSION_MODULES.SERVICES,
    action: PERMISSION_ACTIONS.APPROVE,
    key: 'services.approve',
    label: 'Approve Services',
    description: 'Approve or reject service requests',
  },
  {
    module: PERMISSION_MODULES.SERVICES,
    action: PERMISSION_ACTIONS.ASSIGN,
    key: 'services.assign',
    label: 'Assign Technician',
    description: 'Assign technicians to services',
  },

  // Users
  {
    module: PERMISSION_MODULES.USERS,
    action: PERMISSION_ACTIONS.VIEW,
    key: 'users.view',
    label: 'View Users',
    description: 'View user list and profiles',
  },
  {
    module: PERMISSION_MODULES.USERS,
    action: PERMISSION_ACTIONS.CREATE,
    key: 'users.create',
    label: 'Create Users',
    description: 'Add new users to system',
  },
  {
    module: PERMISSION_MODULES.USERS,
    action: PERMISSION_ACTIONS.EDIT,
    key: 'users.edit',
    label: 'Edit Users',
    description: 'Modify user information',
  },
  {
    module: PERMISSION_MODULES.USERS,
    action: PERMISSION_ACTIONS.DELETE,
    key: 'users.delete',
    label: 'Delete Users',
    description: 'Remove users from system',
  },

  // Regions
  {
    module: PERMISSION_MODULES.REGIONS,
    action: PERMISSION_ACTIONS.VIEW,
    key: 'regions.view',
    label: 'View Regions',
    description: 'View regions',
  },
  {
    module: PERMISSION_MODULES.REGIONS,
    action: PERMISSION_ACTIONS.CREATE,
    key: 'regions.create',
    label: 'Manage Regions',
    description: 'Create, edit, delete regions',
  },

  // Reports
  {
    module: PERMISSION_MODULES.REPORTS,
    action: PERMISSION_ACTIONS.VIEW,
    key: 'reports.view',
    label: 'View Reports',
    description: 'Access reports and analytics',
  },
  {
    module: PERMISSION_MODULES.REPORTS,
    action: PERMISSION_ACTIONS.EXPORT,
    key: 'reports.export',
    label: 'Export Reports',
    description: 'Export reports to Excel/PDF',
  },

  // Dashboard
  {
    module: PERMISSION_MODULES.DASHBOARD,
    action: PERMISSION_ACTIONS.VIEW,
    key: 'dashboard.view',
    label: 'View Dashboard',
    description: 'Access dashboard and analytics',
  },
];

// Group permissions by module for UI display
export const PERMISSIONS_BY_MODULE = ALL_PERMISSIONS.reduce(
  (acc, perm) => {
    if (!acc[perm.module]) {
      acc[perm.module] = [];
    }
    acc[perm.module].push(perm);
    return acc;
  },
  {} as Record<string, Permission[]>,
);
