# Super Admin System Setup Guide

## Overview
The super admin system allows designated administrators to view and monitor all users' data across the entire Ezary CMS platform, while regular users only see their own data.

## Database Setup

### Step 1: Run the Migration
Execute the migration file to create the user roles table:

```sql
-- File: supabase/migrations/007_create_user_roles.sql
```

This migration will:
- Create the `user_roles` table
- Set up Row Level Security (RLS) policies
- Create a trigger to automatically assign 'user' role to new users
- Populate roles for existing users (defaults to 'user')

### Step 2: Manually Assign Admin Roles
Since you create accounts manually in Supabase, you need to assign admin roles manually:

#### Option A: Using Supabase SQL Editor
```sql
-- Make a user a super admin
UPDATE user_roles 
SET role = 'superadmin' 
WHERE user_id = 'USER_ID_HERE';

-- Make a user a regular admin
UPDATE user_roles 
SET role = 'admin' 
WHERE user_id = 'USER_ID_HERE';

-- Check user roles
SELECT u.email, ur.role 
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id;
```

#### Option B: Using Supabase Table Editor
1. Go to Supabase Dashboard
2. Navigate to "Table Editor" → "user_roles"
3. Find the user by `user_id`
4. Edit the `role` column to 'admin' or 'superadmin'

## User Roles

### Role Types
- **user**: Regular user (default) - sees only their own data
- **admin**: Administrator - sees all data across all users
- **superadmin**: Super Administrator - sees all data across all users

Both 'admin' and 'superadmin' have the same permissions currently. You can extend this in the future.

## Features

### For Regular Users
- View only their own clients
- View only their own transactions
- View only their own debts
- Standard navigation menu (Clients, Debts, Reports)

### For Admin/Super Admin Users
- **Admin Dashboard** - New menu item visible only to admins
- View all users across the system
- Monitor system-wide statistics:
  - Total users
  - Total clients
  - Total balances (KES & USD)
  - Total transactions
  - Total debts
- View detailed user statistics table:
  - User email
  - Number of clients per user
  - KES & USD balances per user
  - Transaction counts
  - Debt counts
  - Join date
- View all clients across all users:
  - Client name and code
  - Owner (user email)
  - Balances (KES & USD)
  - Status
  - Creation date
- Filter clients by user
- Search clients by name, code, or owner email

## How It Works

### Authentication Context
- `AuthContext` now loads the user's role after authentication
- Role is stored in React state and available throughout the app
- `const { user, userRole } = useAuth();`

### Navigation
- `Layout` component checks `userRole`
- If user is 'admin' or 'superadmin', the "Admin" menu item appears
- Shield icon indicates admin section

### Data Access
- Regular users: All queries use `.eq("user_id", user.id)` filter
- Admin users: Queries in AdminDashboard don't use user_id filter
- Admin users see ALL data but cannot modify other users' data (view-only)

### Admin Dashboard Queries
The Admin Dashboard uses Supabase Admin API to:
1. List all auth users: `supabase.auth.admin.listUsers()`
2. Fetch all clients without user_id filter
3. Calculate statistics across all users
4. Display "Created by" information for each record

## Setup Workflow

### For New Installations
1. Run migration: `007_create_user_roles.sql`
2. Create user accounts in Supabase Auth (as you normally do)
3. The trigger automatically assigns 'user' role
4. Manually update roles to 'admin' or 'superadmin' as needed

### For Existing Installations
1. Run migration: `007_create_user_roles.sql`
2. Migration automatically creates 'user' role for all existing users
3. Manually update roles to 'admin' or 'superadmin' as needed

## Code Changes Made

### New Files
1. `supabase/migrations/007_create_user_roles.sql` - Database migration
2. `src/components/AdminDashboard.tsx` - Admin dashboard component

### Modified Files
1. `src/contexts/AuthContext.tsx` - Added userRole state and loading
2. `src/components/Layout.tsx` - Added Admin menu item for admins
3. `src/App.tsx` - Added admin route
4. `src/components/ClientDetail.tsx` - Fixed TypeScript issues

## Security Considerations

### Row Level Security (RLS)
- User roles table has RLS enabled
- Users can only read their own role
- Only admins can manage roles (via policy)

### Data Access
- Admin dashboard is view-only (no edit/delete functionality)
- Admins cannot modify other users' data
- Regular users never see admin menu or dashboard

### Admin Assignment
- Roles are assigned manually in Supabase (you control who is admin)
- No way for users to self-promote to admin
- Trigger ensures new users always start as 'user' role

## Checking User Roles

### Query to See All User Roles
```sql
SELECT 
  u.email,
  ur.role,
  ur.created_at,
  u.created_at as user_created_at
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
ORDER BY ur.created_at DESC;
```

### Query to See Admin Users Only
```sql
SELECT 
  u.email,
  ur.role
FROM auth.users u
JOIN user_roles ur ON u.id = ur.user_id
WHERE ur.role IN ('admin', 'superadmin')
ORDER BY u.email;
```

## Testing the System

### Test as Regular User
1. Login with a regular user account
2. Verify you only see Clients, Debts, Reports in navigation
3. Verify you only see your own clients
4. Try to access `/admin` - should not be visible

### Test as Admin User
1. Assign admin role to a test user
2. Login with that admin account
3. Verify you see Admin menu item in navigation
4. Click Admin - should see Admin Dashboard
5. Verify you can see:
   - System-wide statistics
   - All users and their data
   - All clients across all users
   - Filter and search functionality

## Troubleshooting

### Admin Menu Not Showing
- Check user role: `SELECT * FROM user_roles WHERE user_id = 'YOUR_USER_ID';`
- Ensure role is 'admin' or 'superadmin'
- Clear browser cache and re-login

### No Data Showing in Admin Dashboard
- Check Supabase logs for errors
- Verify user has admin role
- Check browser console for errors
- Ensure migration ran successfully

### "Access Denied" Message
- User role is not 'admin' or 'superadmin'
- User role wasn't loaded properly (check AuthContext)
- Clear session and re-login

## Future Enhancements

Possible future additions:
1. **User Management UI** - Add/edit/delete users from admin dashboard
2. **Role Management UI** - Change user roles from admin dashboard
3. **Activity Logs** - Track user actions and changes
4. **Advanced Filtering** - More complex filters and date ranges
5. **Export Data** - Export all data to CSV/Excel for admins
6. **Audit Trail** - Track who made what changes and when
7. **Multi-level Permissions** - Different permissions for admin vs superadmin
8. **Admin Notifications** - Alert admins of suspicious activity
9. **Bulk Operations** - Bulk edit/delete for admins
10. **Data Analytics** - Advanced charts and insights for admins

## Notes

- Admin functionality is currently view-only
- Admins see all data but cannot modify other users' data
- This is a security feature to prevent accidental data corruption
- If you want admins to edit other users' data, additional RLS policies needed
- Remember: With great power comes great responsibility! 

## Support

For issues or questions about the super admin system, check:
1. Browser console for errors
2. Supabase logs for database errors
3. Network tab for API errors
4. Ensure you're using the latest code version
