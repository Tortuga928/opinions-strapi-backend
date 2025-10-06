#!/usr/bin/env python3
"""
Create a test sysadmin user and get JWT token
"""

import requests
import json

BASE_URL = "http://localhost:1341"

# Step 1: Register a regular user
print("Step 1: Registering test user...")
register_data = {
    "username": "testsysadmin",
    "email": "testsysadmin@test.com",
    "password": "TestAdmin123!"
}

try:
    response = requests.post(f"{BASE_URL}/api/auth/local/register", json=register_data)
    if response.status_code == 200:
        data = response.json()
        user_id = data['user']['id']
        token = data['jwt']
        print(f"✅ User created with ID: {user_id}")
        print(f"📝 JWT Token: {token}")

        # Note: The userRole will be 'reguser' by default
        # You'll need to manually update it in the database or admin panel to 'sysadmin'
        print("\n⚠️  Note: User role is 'reguser' by default")
        print("To make this user a sysadmin, update the database:")
        print(f"UPDATE up_users SET userRole='sysadmin' WHERE id={user_id};")

    else:
        print(f"❌ Registration failed: {response.status_code}")
        print(response.json())

except Exception as e:
    print(f"❌ Error: {e}")
