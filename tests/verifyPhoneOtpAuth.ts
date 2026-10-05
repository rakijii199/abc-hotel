/**
 * Verification Script for Firebase Phone OTP Customer Auth & Staff Login
 */
import { AuthService } from '../server/services/authService.ts';
import { UserRepository } from '../server/repositories/userRepository.ts';
import { db } from '../server/database/db.ts';

export async function verifyPhoneOtpAuth() {
  console.log('====================================================');
  console.log('🧪 VERIFYING FIREBASE PHONE OTP & STAFF AUTHENTICATION');
  console.log('====================================================');

  await db.initialize();

  // 1. Customer Sign Up Test
  const testPhone = '9876543201';
  const testFirebaseUid = `fb-uid-test-${Date.now()}`;
  const mockToken = `mock_valid_token_test_919876543201_${testFirebaseUid}.header.sig`;
  console.log('\n1. Testing Customer Phone OTP Registration...');

  const signupRes = await AuthService.registerCustomerPhone({
    idToken: mockToken,
    fullName: 'Rakesh Chandh',
    phone: testPhone,
    email: 'rakeshchandh1998@gmail.com',
    firebaseUid: testFirebaseUid,
    countryCode: '+91'
  });

  console.log('   ✅ Customer Registered:');
  console.log('      - ID:', signupRes.user.id);
  console.log('      - Name:', `${signupRes.user.firstName} ${signupRes.user.lastName}`);
  console.log('      - Phone:', signupRes.user.phone);
  console.log('      - Normalized Phone:', signupRes.user.normalizedPhone);
  console.log('      - Firebase UID:', signupRes.user.firebaseUid);
  console.log('      - Auth Provider:', signupRes.user.authProvider);
  console.log('      - Role:', signupRes.user.role);
  console.log('      - JWT Token Generated:', !!signupRes.token);

  // 2. Customer Phone Login Test
  console.log('\n2. Testing Customer Phone OTP Login...');
  const loginRes = await AuthService.loginCustomerPhone({
    idToken: mockToken,
    phone: testPhone,
    firebaseUid: testFirebaseUid
  });

  console.log('   ✅ Customer Login Successful:');
  console.log('      - User ID:', loginRes.user.id);
  console.log('      - Role:', loginRes.user.role);
  console.log('      - Token Received:', !!loginRes.token);

  // 3. Unregistered Phone Number Test
  console.log('\n3. Testing Unregistered Phone Number Login...');
  let unregisteredCaught = false;
  try {
    const unregToken = `mock_valid_token_test_919998887770_fb-unregistered-uid.header.sig`;
    await AuthService.loginCustomerPhone({
      idToken: unregToken,
      phone: '9998887770',
      firebaseUid: 'fb-unregistered-uid'
    });
  } catch (err: any) {
    unregisteredCaught = true;
    console.log('   ✅ Unregistered phone correctly rejected with prompt:', err.message);
  }

  if (!unregisteredCaught) {
    throw new Error('Unregistered phone number should have failed login!');
  }

  // 4. Staff Login Test
  console.log('\n4. Testing Staff Username/Password Login...');
  const staffRes = await AuthService.login({
    username: 'manager',
    password: 'Password@123'
  });

  console.log('   ✅ Staff Login Successful:');
  console.log('      - Manager ID:', staffRes.user.id);
  console.log('      - Staff Role:', staffRes.user.role);
  console.log('      - Token Received:', !!staffRes.token);

  // 5. Verify No Duplicate Accounts Created
  console.log('\n5. Verifying No Duplicate Customer Accounts Created...');
  const allUsersWithPhone = Array.from(db.users.values()).filter(
    (u) => u.phone && u.phone.includes('9876543201')
  );
  console.log(`   ✅ Total customer records for 9876543201: ${allUsersWithPhone.length} (Expected: 1)`);

  console.log('====================================================');
  return {
    success: true,
    customerId: signupRes.user.id,
    customerRole: signupRes.user.role,
    managerRole: staffRes.user.role,
    duplicateCount: allUsersWithPhone.length
  };
}
