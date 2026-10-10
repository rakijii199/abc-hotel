/**
 * Authentication & User Service
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.ts';
import { db } from '../database/db.ts';
import { UserRepository } from '../repositories/userRepository.ts';
import { SafeUser, User, UserRole } from '../types/index.ts';
import { verifyCustomerFirebaseToken, VerifiedCustomerToken } from '../config/firebaseAdmin.ts';

const STAFF_PHONE_LOGIN_ERROR = 'Staff accounts must sign in through the staff portal with username and password.';

/**
 * The phone number used for OTP login must come from the verified Firebase
 * token itself (phone sign-in provider), never from the request body.
 */
function requireVerifiedPhone(token: VerifiedCustomerToken): string {
  if (!token.phoneNumber || (token.signInProvider && token.signInProvider !== 'phone')) {
    throw new Error('Phone verification is required. Please verify your phone number with OTP.');
  }
  return token.phoneNumber;
}

export class AuthService {
  public static generateToken(user: SafeUser | User): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName
      },
      config.jwtSecret,
      { algorithm: 'HS256', expiresIn: '7d' }
    );
  }

  public static async register(data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
    role?: UserRole;
  }): Promise<{ user: SafeUser; token: string }> {
    const existing = await UserRepository.findByEmail(data.email);
    if (existing) {
      throw new Error('An account with this email address already exists.');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const userId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // Security Hardening: Public registration is always CUSTOMER role.
    // Privileged employee accounts can only be provisioned by Manager/Admin via /api/manager/employees.
    const newUser: User = {
      id: userId,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: data.email.toLowerCase().trim(),
      phone: data.phone.trim(),
      passwordHash,
      role: 'CUSTOMER',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await UserRepository.create(newUser);
    const safeUser = UserRepository.toSafeUser(newUser);
    const token = this.generateToken(safeUser);

    return { user: safeUser, token };
  }

  public static async registerCustomerPhone(data: {
    idToken: string;
    fullName: string;
    phone?: string;
    email?: string;
    firebaseUid?: string;
    countryCode?: string;
  }): Promise<{ user: SafeUser; token: string }> {
    // Cryptographically verify the client's Firebase ID token
    const verifiedToken = await verifyCustomerFirebaseToken(data.idToken);
    const verifiedUid = verifiedToken.uid;
    const verifiedPhone = requireVerifiedPhone(verifiedToken);

    const cleanPhone = verifiedPhone.trim();
    const cleanDigits = cleanPhone.replace(/[^\d]/g, '').slice(-10);
    const cleanCC = (data.countryCode || '+91').startsWith('+') ? (data.countryCode || '+91') : `+${data.countryCode || '91'}`;
    const normalizedPhone = cleanPhone.startsWith('+') ? cleanPhone.replace(/[^\d+]/g, '') : `${cleanCC}${cleanDigits}`;

    // Find existing account by verified Firebase UID first, then verified phone digits
    let existingUser = (await UserRepository.findByFirebaseUid(verifiedUid)) || 
      (cleanDigits ? await UserRepository.findByPhone(cleanDigits) : null);

    if (existingUser) {
      // Prevent account takeover: if user already has a different verified Firebase UID, reject
      if (existingUser.firebaseUid && existingUser.firebaseUid !== verifiedUid) {
        console.warn(`[SECURITY EVENT] Potential account takeover prevented for user ${existingUser.id}: token UID ${verifiedUid} does not match stored UID ${existingUser.firebaseUid}`);
        throw new Error('Account credentials conflict. Please contact hotel customer support.');
      }

      // Phone OTP can never be used to obtain an employee session.
      if (existingUser.role && existingUser.role !== 'CUSTOMER') {
        console.warn(`[SECURITY EVENT] Phone registration refused for non-customer account ${existingUser.id}`);
        throw new Error(STAFF_PHONE_LOGIN_ERROR);
      }

      // An email can only be attached if no other account owns it.
      let emailUpdate: { email?: string } = {};
      if (data.email?.trim()) {
        const requestedEmail = data.email.toLowerCase().trim();
        const owner = await UserRepository.findByEmail(requestedEmail);
        if (owner && owner.id !== existingUser.id) {
          throw new Error('An account with this email address already exists.');
        }
        emailUpdate = { email: requestedEmail };
      }

      await UserRepository.update(existingUser.id, {
        role: 'CUSTOMER',
        firstName: data.fullName?.trim().split(' ')[0] || existingUser.firstName,
        lastName: data.fullName?.trim().split(' ').slice(1).join(' ') || existingUser.lastName,
        firebaseUid: verifiedUid,
        authProvider: 'PHONE',
        normalizedPhone,
        lastLoginAt: new Date().toISOString(),
        ...emailUpdate
      });
      const updated = (await UserRepository.findById(existingUser.id))!;
      const safeUser = UserRepository.toSafeUser(updated);
      const token = this.generateToken(safeUser);
      return { user: safeUser, token };
    }

    const nameParts = (data.fullName || 'Customer').trim().split(' ');
    const firstName = nameParts[0] || 'Customer';
    const lastName = nameParts.slice(1).join(' ') || '';
    const userId = `usr-cust-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const email = data.email?.trim() ? data.email.toLowerCase().trim() : `${cleanDigits || verifiedUid.slice(-8)}@customer.abchotel.com`;
    if (await UserRepository.findByEmail(email)) {
      throw new Error('An account with this email address already exists.');
    }

    const newUser: User = {
      id: userId,
      firstName,
      lastName,
      username: `cust_${cleanDigits || verifiedUid.slice(-6)}`,
      email,
      phone: cleanPhone || normalizedPhone,
      normalizedPhone,
      firebaseUid: verifiedUid,
      authProvider: 'PHONE',
      passwordHash: '',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };

    await UserRepository.create(newUser);
    const safeUser = UserRepository.toSafeUser(newUser);
    const token = this.generateToken(safeUser);

    return { user: safeUser, token };
  }

  public static async loginCustomerPhone(data: {
    idToken: string;
    phone?: string;
    firebaseUid?: string;
  }): Promise<{ user: SafeUser; token: string }> {
    // Cryptographically verify the client's Firebase ID token
    const verifiedToken = await verifyCustomerFirebaseToken(data.idToken);
    const verifiedUid = verifiedToken.uid;
    const verifiedPhone = requireVerifiedPhone(verifiedToken);
    const cleanDigits = verifiedPhone.trim().replace(/[^\d]/g, '').slice(-10);

    // Look up by verified UID first, then verified phone
    let user = (await UserRepository.findByFirebaseUid(verifiedUid)) || 
      (cleanDigits ? await UserRepository.findByPhone(cleanDigits) : null);

    if (!user) {
      throw new Error('No registered customer account found with this phone number. Please sign up first.');
    }

    // Account takeover guard: if user has a different stored firebaseUid, verify authenticity
    if (user.firebaseUid && user.firebaseUid !== verifiedUid) {
      console.warn(`[SECURITY EVENT] UID mismatch during customer login for user ${user.id}: token UID ${verifiedUid} vs stored UID ${user.firebaseUid}`);
      throw new Error('Authentication credential conflict. Please verify your phone number again.');
    }

    if (user.status === 'INACTIVE' || user.status === 'REMOVED' || user.status === 'SUSPENDED') {
      throw new Error('Your account is inactive or suspended. Please contact hotel customer support.');
    }

    // Phone OTP can never be used to obtain an employee session.
    if (user.role && user.role !== 'CUSTOMER') {
      console.warn(`[SECURITY EVENT] Phone login refused for non-customer account ${user.id}`);
      throw new Error(STAFF_PHONE_LOGIN_ERROR);
    }

    await UserRepository.update(user.id, {
      firebaseUid: verifiedUid,
      authProvider: 'PHONE',
      lastLoginAt: new Date().toISOString()
    });

    const updated = (await UserRepository.findById(user.id))!;
    const safeUser = UserRepository.toSafeUser(updated);
    const token = this.generateToken(safeUser);

    return { user: safeUser, token };
  }

  public static async login(credentials: {
    email?: string;
    username?: string;
    password: string;
  }): Promise<{ user: SafeUser; token: string }> {
    const identifier = (credentials.username || credentials.email || '').trim();
    if (!identifier) {
      throw new Error('Please enter your username or email address.');
    }

    const user = await UserRepository.findByUsernameOrEmail(identifier);
    if (!user) {
      throw new Error('Invalid username/email or password.');
    }

    if (user.status === 'INACTIVE' || user.status === 'REMOVED') {
      throw new Error('Your account is inactive. Please contact your restaurant manager.');
    }

    if (user.status !== 'ACTIVE') {
      throw new Error('Your account has been suspended. Please contact hotel concierge.');
    }

    const isMatch = !!user.passwordHash && (await bcrypt.compare(credentials.password, user.passwordHash));
    if (!isMatch) {
      throw new Error('Invalid username/email or password.');
    }

    // Update lastLoginAt
    await UserRepository.update(user.id, { lastLoginAt: new Date().toISOString() });

    const safeUser = UserRepository.toSafeUser(user);
    const token = this.generateToken(safeUser);

    return { user: safeUser, token };
  }

  public static async updateProfile(
    userId: string,
    data: { firstName?: string; lastName?: string; phone?: string }
  ): Promise<SafeUser> {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new Error('User not found.');
    }

    const updated = await UserRepository.update(userId, {
      ...(data.firstName && { firstName: data.firstName.trim() }),
      ...(data.lastName && { lastName: data.lastName.trim() }),
      ...(data.phone && { phone: data.phone.trim() })
    });

    if (!updated) {
      throw new Error('Failed to update profile.');
    }

    return UserRepository.toSafeUser(updated);
  }

  public static async changePassword(
    userId: string,
    data: { currentPassword: string; newPassword: string }
  ): Promise<void> {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new Error('User not found.');
    }

    const isMatch = await bcrypt.compare(data.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new Error('Current password is incorrect.');
    }

    const newHash = await bcrypt.hash(data.newPassword, 10);
    await UserRepository.update(userId, { passwordHash: newHash });
  }

  public static async getUserById(userId: string): Promise<SafeUser | null> {
    const user = await UserRepository.findById(userId);
    return user ? UserRepository.toSafeUser(user) : null;
  }

  public static getUserByIdSync(userId: string): SafeUser | null {
    const user = UserRepository.findByIdSync(userId);
    return user ? UserRepository.toSafeUser(user) : null;
  }
}
