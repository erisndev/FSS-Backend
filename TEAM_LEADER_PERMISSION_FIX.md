# Team Leader Permission Fix

## Issue
Team leaders were missing the `canManageVerificationRequests` permission when it was added to the system.

## Solution Implemented

### 1. Updated Registration Process
**File:** `src/controllers/auth.controller.js`

When a new issuer registers and becomes a team leader, they now get ALL permissions:

```javascript
await TeamMember.create({
  organization: organization._id,
  user: user._id,
  role: "team_leader",
  permissions: {
    canCreateTenders: true,
    canEditTenders: true,
    canDeleteTenders: true,
    canViewApplications: true,
    canAcceptReject: true,
    canManageVerificationRequests: true, // ✅ NOW INCLUDED
    canManageTeam: true,
  },
  isActive: true,
});
```

### 2. Permission Preset Already Correct
**File:** `src/controllers/teamMember.controller.js`

The TEAM_LEADER preset already has all permissions set to true:

```javascript
TEAM_LEADER: {
  canCreateTenders: true,
  canEditTenders: true,
  canDeleteTenders: true,
  canViewApplications: true,
  canAcceptReject: true,
  canManageVerificationRequests: true, // ✅ ALREADY INCLUDED
  canManageTeam: true,
}
```

---

## Migration for Existing Team Leaders

If you have existing team leaders in your database who were created before this fix, run this migration:

### Option 1: MongoDB Shell

```javascript
// Connect to your database
use your_database_name

// Update all team leaders to have the missing permission
db.teammembers.updateMany(
  { role: "team_leader" },
  { 
    $set: { 
      "permissions.canManageVerificationRequests": true 
    } 
  }
)

// Verify the update
db.teammembers.find({ role: "team_leader" }).pretty()
```

### Option 2: Node.js Migration Script

Create a file `migrations/updateTeamLeaders.js`:

```javascript
import mongoose from 'mongoose';
import TeamMember from '../src/models/TeamMember.js';
import dotenv from 'dotenv';

dotenv.config();

const updateTeamLeaders = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to database');

    // Find all team leaders
    const teamLeaders = await TeamMember.find({ role: 'team_leader' });
    console.log(`Found ${teamLeaders.length} team leaders`);

    let updated = 0;
    for (const leader of teamLeaders) {
      // Check if they're missing the permission
      if (!leader.permissions.canManageVerificationRequests) {
        leader.permissions.canManageVerificationRequests = true;
        await leader.save();
        updated++;
        console.log(`✅ Updated team leader: ${leader._id}`);
      } else {
        console.log(`✓ Team leader already has permission: ${leader._id}`);
      }
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`Updated: ${updated} team leaders`);
    console.log(`Already correct: ${teamLeaders.length - updated} team leaders`);

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

updateTeamLeaders();
```

Run the migration:
```bash
node migrations/updateTeamLeaders.js
```

### Option 3: API Endpoint (Temporary)

Add a temporary admin endpoint to fix permissions:

```javascript
// In your admin routes
router.post('/admin/fix-team-leader-permissions', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await TeamMember.updateMany(
      { role: 'team_leader' },
      { 
        $set: { 
          'permissions.canManageVerificationRequests': true 
        } 
      }
    );

    res.json({
      message: 'Team leader permissions updated',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
```

---

## Verification

After running the migration, verify that all team leaders have the correct permissions:

### Check in Database
```javascript
db.teammembers.find(
  { role: "team_leader" },
  { 
    role: 1, 
    permissions: 1,
    user: 1 
  }
).pretty()
```

### Expected Result
```javascript
{
  "_id": ObjectId("..."),
  "role": "team_leader",
  "user": ObjectId("..."),
  "permissions": {
    "canCreateTenders": true,
    "canEditTenders": true,
    "canDeleteTenders": true,
    "canViewApplications": true,
    "canAcceptReject": true,
    "canManageVerificationRequests": true, // ✅ MUST BE TRUE
    "canManageTeam": true
  }
}
```

---

## Testing

After the fix, test that team leaders can:

1. ✅ Create tenders
2. ✅ Edit any organization tender
3. ✅ Delete any organization tender
4. ✅ View all applications
5. ✅ Accept/reject applications
6. ✅ Approve verification requests
7. ✅ Reject verification requests
8. ✅ Manage team members

### Test Script

```bash
# Login as team leader
POST /api/auth/login
{
  "email": "teamleader@example.com",
  "password": "password"
}

# Check permissions in response
# Should see all permissions as true

# Test verification request approval
POST /api/verification-requests/:requestId/approve
# Should succeed with 200 OK

# Test verification request rejection
POST /api/verification-requests/:requestId/reject
{
  "reason": "Test rejection"
}
# Should succeed with 200 OK
```

---

## Summary

✅ **Registration Fixed** - New team leaders get all permissions
✅ **Preset Correct** - TEAM_LEADER preset has all permissions
✅ **Migration Available** - Script to fix existing team leaders
✅ **Verification Steps** - How to check permissions are correct
✅ **Testing Guide** - How to verify functionality

---

## Notes

- Team leader permissions **cannot be modified** through the update permissions endpoint (protected)
- Team leaders **cannot be removed** from the organization (protected)
- All new team leaders will automatically have all permissions
- Existing team leaders need the migration script run once

---

**Fixed By:** FSS Development Team
**Date:** 2024
**Version:** 3.1
