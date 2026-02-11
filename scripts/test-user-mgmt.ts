/**
 * Test script for User Management API
 * 
 * This script tests all user management endpoints:
 * 1. List users
 * 2. Create new user
 * 3. Update user role
 * 4. Remove user access
 * 5. Reset password
 * 
 * Prerequisites:
 * - Server running on http://localhost:3000
 * - Valid Firebase token
 * - Existing company with OWNER or ADMIN access
 */

// Use native fetch (Node 18+)
const API_BASE = 'http://localhost:3000/api';

// Configuration - Update these values
const CONFIG = {
    // Your Firebase ID token (get from frontend or Firebase Auth)
    AUTH_TOKEN: 'YOUR_FIREBASE_ID_TOKEN_HERE',

    // Company ID to test with
    COMPANY_ID: 'YOUR_COMPANY_ID_HERE',

    // Test user details
    TEST_USER: {
        email: 'test.user@example.com',
        fullName: 'Test User',
        role: 'EDITOR' as const
    }
};

// Helper for API calls
async function apiCall(method: string, endpoint: string, options: any = {}) {
    const url = new URL(`${API_BASE}${endpoint}`);
    if (options.params) {
        Object.keys(options.params).forEach(key => url.searchParams.append(key, options.params[key]));
    }

    const response = await fetch(url.toString(), {
        method,
        headers: {
            'Authorization': `Bearer ${CONFIG.AUTH_TOKEN}`,
            'Content-Type': 'application/json',
            ...options.headers
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    const data = await response.json() as any;
    if (!response.ok) {
        const error = new Error(data.error || response.statusText);
        (error as any).response = { status: response.status, data };
        throw error;
    }
    return { data, status: response.status };
}

// Color codes for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message: string, color: keyof typeof colors = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string) {
    console.log('\n' + '='.repeat(60));
    log(title, 'cyan');
    console.log('='.repeat(60));
}

async function testListUsers() {
    logSection('TEST 1: List Users');

    try {
        const response = await apiCall('GET', '/users', {
            params: { companyId: CONFIG.COMPANY_ID }
        });

        log(`✓ Success! Found ${response.data.length} users`, 'green');
        console.log('Users:', JSON.stringify(response.data, null, 2));
        return response.data;
    } catch (error: any) {
        log(`✗ Error: ${error.response?.data?.error || error.message}`, 'red');
        throw error;
    }
}

async function testCreateUser() {
    logSection('TEST 2: Create User');

    try {
        const response = await apiCall('POST', '/users', {
            body: {
                email: CONFIG.TEST_USER.email,
                fullName: CONFIG.TEST_USER.fullName,
                role: CONFIG.TEST_USER.role,
                companyId: CONFIG.COMPANY_ID
            }
        });

        log('✓ User created successfully!', 'green');
        console.log('Created user:', JSON.stringify(response.data, null, 2));
        return response.data;
    } catch (error: any) {
        if (error.response?.status === 409) {
            log('⚠ User already exists, continuing...', 'yellow');
            return null;
        }
        log(`✗ Error: ${error.response?.data?.error || error.message}`, 'red');
        throw error;
    }
}

async function testUpdateUserRole(userId: string) {
    logSection('TEST 3: Update User Role');

    try {
        const newRole = 'VIEWER';
        const response = await apiCall('PUT', `/users/${userId}/role`, {
            body: {
                role: newRole,
                companyId: CONFIG.COMPANY_ID
            }
        });

        log(`✓ Role updated to ${newRole}!`, 'green');
        console.log('Updated user:', JSON.stringify(response.data, null, 2));
        return response.data;
    } catch (error: any) {
        log(`✗ Error: ${error.response?.data?.error || error.message}`, 'red');
        throw error;
    }
}

async function testUpdateOwnerRole(userId: string) {
    logSection('TEST 4: Attempt to Update OWNER Role (Should Fail for ADMIN)');

    try {
        const response = await apiCall('PUT', `/users/${userId}/role`, {
            body: {
                role: 'VIEWER',
                companyId: CONFIG.COMPANY_ID
            }
        });

        log('✗ Unexpected success! ADMIN should not be able to modify OWNER', 'red');
        return false;
    } catch (error: any) {
        if (error.response?.status === 403) {
            log('✓ Correctly blocked! ADMIN cannot modify OWNER roles', 'green');
            console.log('Error message:', error.response.data.error);
            return true;
        }
        log(`✗ Unexpected error: ${error.response?.data?.error || error.message}`, 'red');
        return false;
    }
}

async function testResetPassword(userId: string) {
    logSection('TEST 5: Reset Password');

    try {
        const response = await apiCall('POST', `/users/${userId}/reset-password`);

        log('✓ Password reset email sent!', 'green');
        console.log('Response:', JSON.stringify(response.data, null, 2));
        return response.data;
    } catch (error: any) {
        log(`✗ Error: ${error.response?.data?.error || error.message}`, 'red');
        throw error;
    }
}

async function testRemoveAccess(userId: string) {
    logSection('TEST 6: Remove User Access');

    try {
        const response = await apiCall('DELETE', `/users/${userId}`, {
            params: { companyId: CONFIG.COMPANY_ID }
        });

        log('✓ User access removed!', 'green');
        console.log('Response:', JSON.stringify(response.data, null, 2));
        return response.data;
    } catch (error: any) {
        log(`✗ Error: ${error.response?.data?.error || error.message}`, 'red');
        throw error;
    }
}

async function testAuthorizationFailure() {
    logSection('TEST 7: Authorization Failure (No Token)');

    try {
        const response = await fetch(`${API_BASE}/users?companyId=${CONFIG.COMPANY_ID}`);
        const data = await response.json() as any;

        if (response.status === 401) {
            log('✓ Correctly blocked unauthorized request', 'green');
            return true;
        }
        log(`✗ Unexpected success or wrong error status! Status: ${response.status}, Error: ${data.error || response.statusText}`, 'red');
        return false;
    } catch (error: any) {
        // This catch block would typically be hit for network errors or if .json() fails
        log(`✗ Network error or JSON parsing failed: ${error.message}`, 'red');
        return false;
    }
}

async function runAllTests() {
    log('\n🚀 Starting User Management API Tests\n', 'blue');

    // Validate config
    if (CONFIG.AUTH_TOKEN === 'YOUR_FIREBASE_ID_TOKEN_HERE') {
        log('⚠ Please update CONFIG.AUTH_TOKEN in the script', 'yellow');
        return;
    }

    if (CONFIG.COMPANY_ID === 'YOUR_COMPANY_ID_HERE') {
        log('⚠ Please update CONFIG.COMPANY_ID in the script', 'yellow');
        return;
    }

    let createdUserId: string | null = null;

    try {
        // Test 1: List users
        const users = await testListUsers() as any[];

        // Test 2: Create user
        const createdUser = await testCreateUser() as any;
        if (createdUser) {
            createdUserId = createdUser.id;
        } else {
            // If user already exists, find their ID
            const existingUser = users.find((u: any) => u.email === CONFIG.TEST_USER.email);
            if (existingUser) {
                createdUserId = existingUser.id;
                log(`Using existing user ID: ${createdUserId}`, 'yellow');
            }
        }

        if (!createdUserId) {
            log('⚠ No user ID available for further tests', 'yellow');
            return;
        }

        // Test 3: Update role
        await testUpdateUserRole(createdUserId);

        // Test 4: Try to update OWNER role (if any OWNER exists)
        const ownerUser = users.find((u: any) => u.role === 'OWNER');
        if (ownerUser) {
            await testUpdateOwnerRole(ownerUser.id);
        } else {
            log('⚠ No OWNER user found to test role restriction', 'yellow');
        }

        // Test 5: Reset password
        await testResetPassword(createdUserId);

        // Test 6: Remove access
        await testRemoveAccess(createdUserId);

        // Test 7: Authorization failure
        await testAuthorizationFailure();

        logSection('✅ All Tests Completed');

    } catch (error) {
        logSection('❌ Tests Failed');
        console.error(error);
    }
}

// Run tests
runAllTests();
