/**
 * User Data Access Repository
 * Authoritative Firestore database with local memory cache fallback.
 */
import { db } from '../database/db.ts';
import { User, SafeUser, EmployeeStats } from '../types/index.ts';
import {
  getDocFromFirestore,
  loadCollectionFromFirestore,
  queryFirestore,
  saveDocToFirestore
} from '../database/firestoreSync.ts';

export class UserRepository {
  /**
   * Authoritative lookup: queries Firestore, falls back to cache
   */
  public static async findById(id: string): Promise<User | null> {
    if (!id) return null;
    const fsUser = await getDocFromFirestore<User>('users', id);
    if (fsUser) {
      db.users.set(fsUser.id, fsUser);
      if (fsUser.email) db.userEmailIndex.set(fsUser.email.toLowerCase().trim(), fsUser.id);
      if (fsUser.username) db.userUsernameIndex.set(fsUser.username.toLowerCase().trim(), fsUser.id);
      return fsUser;
    }
    return db.users.get(id) || null;
  }

  public static findByIdSync(id: string): User | null {
    return db.users.get(id) || null;
  }

  public static async findByEmail(email: string): Promise<User | null> {
    if (!email) return null;
    const clean = email.toLowerCase().trim();
    const fsUsers = await queryFirestore<User>('users', 'email', '==', clean);
    if (fsUsers && fsUsers.length > 0) {
      const u = fsUsers[0];
      db.users.set(u.id, u);
      db.userEmailIndex.set(clean, u.id);
      return u;
    }
    const id = db.userEmailIndex.get(clean);
    if (id) return db.users.get(id) || null;
    return null;
  }

  public static async findByUsername(username: string): Promise<User | null> {
    if (!username) return null;
    const clean = username.toLowerCase().trim();
    const fsUsers = await queryFirestore<User>('users', 'username', '==', clean);
    if (fsUsers && fsUsers.length > 0) {
      const u = fsUsers[0];
      db.users.set(u.id, u);
      db.userUsernameIndex.set(clean, u.id);
      return u;
    }
    const id = db.userUsernameIndex.get(clean);
    if (id) return db.users.get(id) || null;
    return null;
  }

  public static async findByUsernameOrEmail(identifier: string): Promise<User | null> {
    if (!identifier) return null;
    const clean = identifier.toLowerCase().trim();
    
    // Check by username
    const byU = await this.findByUsername(clean);
    if (byU) return byU;

    // Check by email
    const byE = await this.findByEmail(clean);
    if (byE) return byE;

    // Direct scan fallback across all users
    for (const u of db.users.values()) {
      if (u.username && u.username.toLowerCase().trim() === clean) return u;
      if (u.email && u.email.toLowerCase().trim() === clean) return u;
    }
    return null;
  }

  public static async findByPhone(phone: string): Promise<User | null> {
    if (!phone) return null;
    const digits = phone.replace(/[^\d]/g, '');
    if (!digits) return null;

    // Check Firestore
    const fsUsers = await loadCollectionFromFirestore<User>('users');
    const source = fsUsers && fsUsers.length > 0 ? fsUsers : Array.from(db.users.values());
    for (const u of source) {
      if (u.phone) {
        const uDigits = u.phone.replace(/[^\d]/g, '');
        if (uDigits.length >= 10 && digits.length >= 10 && uDigits.slice(-10) === digits.slice(-10)) {
          db.users.set(u.id, u);
          return u;
        }
      }
      if (u.normalizedPhone) {
        const uDigits = u.normalizedPhone.replace(/[^\d]/g, '');
        if (uDigits.length >= 10 && digits.length >= 10 && uDigits.slice(-10) === digits.slice(-10)) {
          db.users.set(u.id, u);
          return u;
        }
      }
    }
    return null;
  }

  public static async findByFirebaseUid(uid: string): Promise<User | null> {
    if (!uid) return null;
    const fsUsers = await queryFirestore<User>('users', 'firebaseUid', '==', uid);
    if (fsUsers && fsUsers.length > 0) {
      const u = fsUsers[0];
      db.users.set(u.id, u);
      return u;
    }
    for (const u of db.users.values()) {
      if (u.firebaseUid === uid) return u;
    }
    return null;
  }

  public static toSafeUser(user: User): SafeUser {
    const { passwordHash, ...safe } = user;
    return safe;
  }

  public static async create(user: User): Promise<User> {
    db.users.set(user.id, user);
    if (user.email) {
      db.userEmailIndex.set(user.email.toLowerCase().trim(), user.id);
    }
    if (user.username) {
      db.userUsernameIndex.set(user.username.toLowerCase().trim(), user.id);
    }
    await saveDocToFirestore('users', user.id, user);
    db.persist();
    return user;
  }

  public static async update(id: string, updates: Partial<User>): Promise<User | null> {
    const user = await this.findById(id);
    if (!user) return null;

    if (updates.email && updates.email.toLowerCase().trim() !== (user.email || '').toLowerCase().trim()) {
      db.userEmailIndex.delete((user.email || '').toLowerCase().trim());
      db.userEmailIndex.set(updates.email.toLowerCase().trim(), id);
    }

    if (updates.username && updates.username.toLowerCase().trim() !== (user.username || '').toLowerCase().trim()) {
      if (user.username) {
        db.userUsernameIndex.delete(user.username.toLowerCase().trim());
      }
      db.userUsernameIndex.set(updates.username.toLowerCase().trim(), id);
    }

    const updatedUser: User = {
      ...user,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    db.users.set(id, updatedUser);
    await saveDocToFirestore('users', id, updatedUser);
    db.persist();
    return updatedUser;
  }

  public static async softRemove(id: string, removedBy: string, reason?: string): Promise<User | null> {
    const user = await this.findById(id);
    if (!user) return null;

    const updatedUser: User = {
      ...user,
      status: 'REMOVED',
      deletedAt: new Date().toISOString(),
      deletedBy: removedBy,
      deletionReason: reason || 'Removed by Manager',
      updatedAt: new Date().toISOString()
    };
    db.users.set(id, updatedUser);
    await saveDocToFirestore('users', id, updatedUser);
    db.persist();
    return updatedUser;
  }

  public static async findEmployees(filters?: {
    role?: string;
    status?: string;
    search?: string;
  }): Promise<User[]> {
    const fsUsers = await loadCollectionFromFirestore<User>('users');
    const source = fsUsers && fsUsers.length > 0 ? fsUsers : Array.from(db.users.values());
    const employeeRoles = ['MANAGER', 'STAFF', 'ADMIN', 'KITCHEN', 'DELIVERY'];
    let list = source.filter((u) => employeeRoles.includes(u.role));

    if (filters?.role && filters.role !== 'ALL') {
      const targetRole = filters.role.toUpperCase();
      if (targetRole === 'STAFF') {
        list = list.filter((u) => u.role === 'STAFF' || u.role === 'ADMIN');
      } else {
        list = list.filter((u) => u.role === targetRole);
      }
    }

    if (filters?.status && filters.status !== 'ALL') {
      const targetStatus = filters.status.toUpperCase();
      list = list.filter((u) => u.status === targetStatus);
    } else {
      if (!filters?.status) {
        list = list.filter((u) => u.status !== 'REMOVED');
      }
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(
        (u) =>
          `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
          (u.username && u.username.toLowerCase().includes(q)) ||
          u.email.toLowerCase().includes(q) ||
          (u.phone && u.phone.includes(q))
      );
    }

    return list.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public static async getEmployeeStats(): Promise<EmployeeStats> {
    const fsUsers = await loadCollectionFromFirestore<User>('users');
    const source = fsUsers && fsUsers.length > 0 ? fsUsers : Array.from(db.users.values());
    const employeeRoles = ['MANAGER', 'STAFF', 'ADMIN', 'KITCHEN', 'DELIVERY'];
    const employees = source.filter((u) => employeeRoles.includes(u.role));

    const totalEmployees = employees.filter((u) => u.status !== 'REMOVED').length;
    const activeEmployees = employees.filter((u) => u.status === 'ACTIVE').length;
    const inactiveEmployees = employees.filter((u) => u.status === 'INACTIVE' || u.status === 'SUSPENDED').length;
    const removedEmployees = employees.filter((u) => u.status === 'REMOVED').length;

    const kitchenCount = employees.filter((u) => u.role === 'KITCHEN' && u.status !== 'REMOVED').length;
    const deliveryCount = employees.filter((u) => u.role === 'DELIVERY' && u.status !== 'REMOVED').length;
    const staffCount = employees.filter((u) => (u.role === 'STAFF' || u.role === 'ADMIN') && u.status !== 'REMOVED').length;
    const managerCount = employees.filter((u) => u.role === 'MANAGER' && u.status !== 'REMOVED').length;

    return {
      totalEmployees,
      activeEmployees,
      inactiveEmployees,
      removedEmployees,
      kitchenCount,
      deliveryCount,
      staffCount,
      managerCount
    };
  }

  public static async getAll(): Promise<SafeUser[]> {
    const fsUsers = await loadCollectionFromFirestore<User>('users');
    const source = fsUsers && fsUsers.length > 0 ? fsUsers : Array.from(db.users.values());
    return source.map(this.toSafeUser);
  }
}
