export const PERMISSION_MODULES = {
  CUSTOMERS: 'customers',
  SERVICES: 'services',
  USERS: 'users',
  REGIONS: 'regions',
  REPORTS: 'reports',
  DASHBOARD: 'dashboard',
  // ✅ NEW: Product Management Modules
  PRODUCTS: 'products',
  SPARE_PARTS: 'spare_parts',
  CATEGORIES: 'categories',
  GROUPS: 'groups',
  ASSEMBLY: 'assembly',
  STOCK: 'stock',
} as const;

export const PERMISSION_ACTIONS = {
  VIEW: 'view',
  CREATE: 'create',
  EDIT: 'edit',
  UPDATE: 'update', // ✅ NEW: Alias for edit
  DELETE: 'delete',
  APPROVE: 'approve',
  ASSIGN: 'assign',
  EXPORT: 'export',
  MANAGE: 'manage', // ✅ NEW: For combined create/edit/delete
  EXECUTE: 'execute', // ✅ NEW: For assembly execution
  TRANSFER: 'transfer', // ✅ NEW: For stock transfers
} as const;

export interface Permission {
  module: string;
  action: string;
  key: string;
  label: string;
  description: string;
  isDefault?: boolean;
}

export const ALL_PERMISSIONS: Permission[] = [
  // ==========================================
  // DASHBOARD
  // ==========================================
  {
    module: PERMISSION_MODULES.DASHBOARD,
    action: PERMISSION_ACTIONS.VIEW,
    key: 'dashboard.view',
    label: 'View Dashboard',
    description: 'Access dashboard and analytics',
  },

  // ==========================================
  // CUSTOMERS
  // ==========================================
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

  // ==========================================
  // SERVICES
  // ==========================================
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

  // ==========================================
  // USERS
  // ==========================================
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

  // ==========================================
  // REGIONS
  // ==========================================
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

  // ==========================================
  // REPORTS
  // ==========================================
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

  // ==========================================
  // ✅ NEW: PRODUCTS (Finished Goods)
  // ==========================================
  {
    module: PERMISSION_MODULES.PRODUCTS,
    action: PERMISSION_ACTIONS.VIEW,
    key: 'products.view',
    label: 'View Products',
    description: 'View finished products list and details',
  },
  {
    module: PERMISSION_MODULES.PRODUCTS,
    action: PERMISSION_ACTIONS.CREATE,
    key: 'products.create',
    label: 'Create Products',
    description: 'Add new finished products',
  },
  {
    module: PERMISSION_MODULES.PRODUCTS,
    action: PERMISSION_ACTIONS.UPDATE,
    key: 'products.update',
    label: 'Update Products',
    description: 'Modify product information and stock',
  },
  {
    module: PERMISSION_MODULES.PRODUCTS,
    action: PERMISSION_ACTIONS.DELETE,
    key: 'products.delete',
    label: 'Delete Products',
    description: 'Remove products from system',
  },

  // ==========================================
  // ✅ NEW: SPARE PARTS
  // ==========================================
  {
    module: PERMISSION_MODULES.SPARE_PARTS,
    action: PERMISSION_ACTIONS.VIEW,
    key: 'spare_parts.view',
    label: 'View Spare Parts',
    description: 'View spare parts inventory',
  },
  {
    module: PERMISSION_MODULES.SPARE_PARTS,
    action: PERMISSION_ACTIONS.CREATE,
    key: 'spare_parts.create',
    label: 'Create Spare Parts',
    description: 'Add new spare parts to inventory',
  },
  {
    module: PERMISSION_MODULES.SPARE_PARTS,
    action: PERMISSION_ACTIONS.UPDATE,
    key: 'spare_parts.update',
    label: 'Update Spare Parts',
    description: 'Modify spare part information',
  },
  {
    module: PERMISSION_MODULES.SPARE_PARTS,
    action: PERMISSION_ACTIONS.DELETE,
    key: 'spare_parts.delete',
    label: 'Delete Spare Parts',
    description: 'Remove spare parts from system',
  },

  // ==========================================
  // ✅ NEW: PRODUCT CATEGORIES
  // ==========================================
  {
    module: PERMISSION_MODULES.CATEGORIES,
    action: PERMISSION_ACTIONS.VIEW,
    key: 'categories.view',
    label: 'View Product Categories',
    description: 'View product categories (RO, UV, etc.)',
  },
  {
    module: PERMISSION_MODULES.CATEGORIES,
    action: PERMISSION_ACTIONS.MANAGE,
    key: 'categories.manage',
    label: 'Manage Product Categories',
    description: 'Create, edit, delete product categories',
  },

  // ==========================================
  // ✅ NEW: SPARE PART GROUPS
  // ==========================================
  {
    module: PERMISSION_MODULES.GROUPS,
    action: PERMISSION_ACTIONS.VIEW,
    key: 'groups.view',
    label: 'View Spare Part Groups',
    description: 'View spare part groups (Filters, Electronics, etc.)',
  },
  {
    module: PERMISSION_MODULES.GROUPS,
    action: PERMISSION_ACTIONS.MANAGE,
    key: 'groups.manage',
    label: 'Manage Spare Part Groups',
    description: 'Create, edit, delete spare part groups',
  },

  // ==========================================
  // ✅ NEW: ASSEMBLY / BOM
  // ==========================================
  {
    module: PERMISSION_MODULES.ASSEMBLY,
    action: PERMISSION_ACTIONS.VIEW,
    key: 'assembly.view',
    label: 'View Assemblies',
    description: 'View BOM templates and assembly history',
  },
  {
    module: PERMISSION_MODULES.ASSEMBLY,
    action: PERMISSION_ACTIONS.CREATE,
    key: 'assembly.create',
    label: 'Create Assembly Templates',
    description: 'Create and edit BOM templates',
  },
  {
    module: PERMISSION_MODULES.ASSEMBLY,
    action: PERMISSION_ACTIONS.EXECUTE,
    key: 'assembly.execute',
    label: 'Execute Assemblies',
    description: 'Assemble products from spare parts',
  },
  {
    module: PERMISSION_MODULES.ASSEMBLY,
    action: PERMISSION_ACTIONS.DELETE,
    key: 'assembly.delete',
    label: 'Delete Assembly Templates',
    description: 'Remove BOM templates',
  },

  // ==========================================
  // ✅ NEW: STOCK MANAGEMENT
  // ==========================================
  {
    module: PERMISSION_MODULES.STOCK,
    action: PERMISSION_ACTIONS.VIEW,
    key: 'stock.view',
    label: 'View Stock',
    description: 'View stock levels and technician stock',
  },
  {
    module: PERMISSION_MODULES.STOCK,
    action: PERMISSION_ACTIONS.UPDATE,
    key: 'stock.update',
    label: 'Update Stock',
    description: 'Adjust warehouse stock levels',
  },
  {
    module: PERMISSION_MODULES.STOCK,
    action: PERMISSION_ACTIONS.TRANSFER,
    key: 'stock.transfer',
    label: 'Transfer Stock',
    description: 'Transfer stock to technicians',
  },
];

// ==========================================
// ✅ UPDATED: Default permissions by role
// ==========================================
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  'Super Admin': [
    // Super Admin gets ALL permissions automatically in PermissionsGuard
    // No need to list them here
  ],

  Admin: [
    'dashboard.view',
    // Customers
    'customers.view',
    'customers.create',
    'customers.edit',
    'customers.delete',
    // Services
    'services.view',
    'services.create',
    'services.edit',
    'services.delete',
    'services.approve',
    'services.assign',
    // Users
    'users.view',
    'users.create',
    'users.edit',
    // Regions
    'regions.view',
    'regions.create',
    // Reports
    'reports.view',
    'reports.export',
    // ✅ NEW: Products
    'products.view',
    'products.create',
    'products.update',
    'products.delete',
    // ✅ NEW: Spare Parts
    'spare_parts.view',
    'spare_parts.create',
    'spare_parts.update',
    'spare_parts.delete',
    // ✅ NEW: Categories & Groups
    'categories.view',
    'categories.manage',
    'groups.view',
    'groups.manage',
    // ✅ NEW: Assembly
    'assembly.view',
    'assembly.create',
    'assembly.execute',
    'assembly.delete',
    // ✅ NEW: Stock
    'stock.view',
    'stock.update',
    'stock.transfer',
  ],

  'Service Admin': [
    'dashboard.view',
    'customers.view',
    'customers.edit',
    'services.view',
    'services.create',
    'services.edit',
    'services.approve',
    'services.assign',
    'users.view',
    'reports.view',
    // ✅ NEW: Limited product access
    'products.view',
    'spare_parts.view',
    'stock.view',
  ],

  'Service Team Lead': [
    'dashboard.view',
    'services.view',
    'services.create',
    'services.edit',
    'services.assign',
    'customers.view',
    'customers.edit',
    'reports.view',
    // ✅ NEW: Stock viewing only
    'products.view',
    'spare_parts.view',
    'stock.view',
  ],

  Technician: [
    'dashboard.view',
    'services.view',
    'services.edit',
    'customers.view',
    'customers.edit',
    // ✅ NEW: View products and spare parts for service work
    'products.view',
    'spare_parts.view',
    'stock.view',
  ],

  'Sales Admin': [
    'dashboard.view',
    'customers.view',
    'customers.create',
    'customers.edit',
    'services.view',
    'services.create',
    'reports.view',
    // ✅ NEW: Product viewing for sales quotes
    'products.view',
    'categories.view',
  ],

  // ✅ NEW: Inventory Manager Role
  'Inventory Manager': [
    'dashboard.view',
    'products.view',
    'products.create',
    'products.update',
    'spare_parts.view',
    'spare_parts.create',
    'spare_parts.update',
    'categories.view',
    'categories.manage',
    'groups.view',
    'groups.manage',
    'assembly.view',
    'assembly.create',
    'assembly.execute',
    'stock.view',
    'stock.update',
    'stock.transfer',
    'reports.view',
  ],

  // ✅ NEW: Assembly Technician Role
  'Assembly Technician': [
    'dashboard.view',
    'products.view',
    'spare_parts.view',
    'assembly.view',
    'assembly.execute',
    'stock.view',
  ],
};

// ✅ Helper function to get default permissions for a role
export function getDefaultPermissionsForRole(roleName: string): string[] {
  return DEFAULT_ROLE_PERMISSIONS[roleName] || [];
}

// ✅ Check if a permission is default for a role
export function isDefaultPermission(
  roleName: string,
  permissionKey: string,
): boolean {
  const defaults = DEFAULT_ROLE_PERMISSIONS[roleName] || [];
  return defaults.includes(permissionKey);
}

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
