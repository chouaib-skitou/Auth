import { DataSource } from 'typeorm';
import { Role } from '../../roles/entities/role.entity';
import { Permission } from '../../permissions/entities/permission.entity';

export async function seedRBAC(dataSource: DataSource): Promise<void> {
  const permissionRepo = dataSource.getRepository(Permission);
  const roleRepo = dataSource.getRepository(Role);

  const permissionsData = [
    { name: 'READ_USERS', description: 'Can view users' },
    { name: 'CREATE_USERS', description: 'Can create users' },
    { name: 'UPDATE_USERS', description: 'Can update users' },
    { name: 'DELETE_USERS', description: 'Can delete users' },
    { name: 'MANAGE_FINANCES', description: 'Can manage finances' },
    { name: 'VIEW_REPORTS', description: 'Can view financial reports' },
    { name: 'MANAGE_TEAM', description: 'Can manage team members' },
    { name: 'READ_OWN_DATA', description: 'Can read own data' },
    { name: 'UPDATE_OWN_DATA', description: 'Can update own data' },
  ];

  const savedPermissions: Permission[] = [];

  for (const perm of permissionsData) {
    const existing = await permissionRepo.findOne({ where: { name: perm.name } });
    if (!existing) {
      const newPerm = permissionRepo.create(perm);
      const saved = await permissionRepo.save(newPerm);
      savedPermissions.push(saved);
      console.log('Created permission: ' + perm.name);
    } else {
      savedPermissions.push(existing);
      console.log('Permission exists: ' + perm.name);
    }
  }

  const getPermsByNames = (names: string[]): Permission[] => {
    return savedPermissions.filter((perm) => names.includes(perm.name));
  };

  const rolesConfig = [
    { name: 'ADMIN', description: 'Administrator with full access', permissionNames: permissionsData.map((p) => p.name) },
    { name: 'MANAGER', description: 'Manager with team management rights', permissionNames: ['READ_USERS', 'CREATE_USERS', 'MANAGE_TEAM', 'VIEW_REPORTS', 'READ_OWN_DATA', 'UPDATE_OWN_DATA'] },
    { name: 'ACCOUNTANT', description: 'Accountant with financial access', permissionNames: ['MANAGE_FINANCES', 'VIEW_REPORTS', 'READ_OWN_DATA', 'UPDATE_OWN_DATA'] },
    { name: 'SUPPORT', description: 'Support team member', permissionNames: ['READ_USERS', 'READ_OWN_DATA'] },
    { name: 'USER', description: 'Regular user', permissionNames: ['READ_OWN_DATA', 'UPDATE_OWN_DATA'] },
  ];

  for (const config of rolesConfig) {
    const existing = await roleRepo.findOne({ where: { name: config.name } });
    if (!existing) {
      const role = roleRepo.create({ name: config.name, description: config.description, permissions: getPermsByNames(config.permissionNames) });
      await roleRepo.save(role);
      console.log('Created role: ' + config.name + ' with ' + config.permissionNames.length + ' permissions');
    } else {
      console.log('Role exists: ' + config.name);
    }
  }
}
