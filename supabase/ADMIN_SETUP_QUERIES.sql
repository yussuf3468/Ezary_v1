-- QUICK ADMIN SETUP GUIDE
-- Run these commands in Supabase SQL Editor

-- 1. First, check all users and their current roles
SELECT 
  u.id,
  u.email,
  COALESCE(ur.role, 'NO ROLE YET') as role
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
ORDER BY u.email;

-- 2. Make a specific user a SUPER ADMIN (replace 'user@example.com' with actual email)
UPDATE user_roles 
SET role = 'superadmin' 
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'user@example.com'
);

-- 3. Make a specific user a REGULAR ADMIN (replace 'user@example.com' with actual email)
UPDATE user_roles 
SET role = 'admin' 
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'user@example.com'
);

-- 4. Make a user a REGULAR USER again (replace 'user@example.com' with actual email)
UPDATE user_roles 
SET role = 'user' 
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'user@example.com'
);

-- 5. List all admin users
SELECT 
  u.email,
  ur.role,
  ur.updated_at
FROM auth.users u
JOIN user_roles ur ON u.id = ur.user_id
WHERE ur.role IN ('admin', 'superadmin')
ORDER BY ur.updated_at DESC;

-- 6. Count users by role
SELECT 
  COALESCE(ur.role, 'NO ROLE') as role,
  COUNT(*) as user_count
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
GROUP BY ur.role
ORDER BY user_count DESC;

-- EXAMPLE: Make the first user in the system a super admin
-- (Useful when setting up for the first time)
UPDATE user_roles 
SET role = 'superadmin' 
WHERE user_id = (
  SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1
);

-- Verify the change
SELECT 
  u.email,
  ur.role,
  u.created_at
FROM auth.users u
JOIN user_roles ur ON u.id = ur.user_id
WHERE ur.role = 'superadmin';
