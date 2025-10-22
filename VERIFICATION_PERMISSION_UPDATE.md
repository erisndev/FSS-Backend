# Verification Request Permission - Implementation Summary

## New Permission Added

### Permission Name
`canManageVerificationRequests`

### Purpose
Controls who can approve or reject verification code requests from bidders who want to apply for tenders.

---

## Visibility

### Verification Requests Visibility

**All team members in an organization can see verification requests for their organization's tenders:**

```javascript
// Admin - sees ALL requests
if (user.role === 'admin') {
  // No filter
}
// Team member - sees organization's requests
else if (user.organizationId) {
  // Get all tenders from organization
  const orgTenders = await Tender.find({ 
    organization: user.organizationId 
  });
  // Show requests for these tenders
}
// Individual issuer - sees only their requests
else {
  // Get only user's tenders
  const userTenders = await Tender.find({ 
    createdBy: user._id 
  });
}
```

**Benefits:**
- ✅ All team members can view verification requests
- ✅ Team members with permission can approve/reject
- ✅ Better collaboration within teams
- ✅ Transparent request management

---

## Changes Made

### 1. TeamMember Model Updated
**File:** `src/models/TeamMember.js`

**Added Permission:**
```javascript
permissions: {
  canCreateTenders: { type: Boolean, default: false },
  canEditTenders: { type: Boolean, default: false },
  canDeleteTenders: { type: Boolean, default: false },
  canViewApplications: { type: Boolean, default: false },
  canAcceptReject: { type: Boolean, default: false },
  canManageVerificationRequests: { type: Boolean, default: false }, // ✅ NEW
  canManageTeam: { type: Boolean, default: false },
}
```

### 2. Permission Presets Updated
**File:** `src/controllers/teamMember.controller.js`

```javascript
const PERMISSION_PRESETS = {
  TEAM_LEADER: {
    canCreateTenders: true,
    canEditTenders: true,
    canDeleteTenders: true,
    canViewApplications: true,
    canAcceptReject: true,
    canManageVerificationRequests: true, // ✅ NEW
    canManageTeam: true,
  },
  FULL_ACCESS: {
    canCreateTenders: true,
    canEditTenders: true,
    canDeleteTenders: false,
    canViewApplications: true,
    canAcceptReject: true,
    canManageVerificationRequests: true, // ✅ NEW
    canManageTeam: false,
  },
  LIMITED_ACCESS: {
    canCreateTenders: true,
    canEditTenders: false,
    canDeleteTenders: false,
    canViewApplications: true,
    canAcceptReject: false,
    canManageVerificationRequests: false, // ✅ NEW
    canManageTeam: false,
  },
  VIEWER: {
    canCreateTenders: false,
    canEditTenders: false,
    canDeleteTenders: false,
    canViewApplications: true,
    canAcceptReject: false,
    canManageVerificationRequests: false, // ✅ NEW
    canManageTeam: false,
  },
};
```

### 3. Verification Code Controller Updated
**File:** `src/controllers/verificationCode.controller.js`

**Updated Visibility:**
- ✅ `getVerificationCodeRequests()` - Shows all organization's requests to team members

**Added Permission Checks to:**
- ✅ `approveVerificationCodeRequest()` - Checks `canManageVerificationRequests`
- ✅ `rejectVerificationCodeRequest()` - Checks `canManageVerificationRequests`

**Added Activity Logging:**
- ✅ Logs `approve_verification_request` action
- ✅ Logs `reject_verification_request` action

---

## Permission Logic

### Approve/Reject Verification Requests

```javascript
// Admin can always approve/reject
if (isAdmin) {
  // Allow
}
// Team member in organization
else if (user.organizationId) {
  // Check if tender belongs to same organization
  if (!sameOrganization) {
    return 403; // Forbidden
  }
  
  // Check team member permissions
  const teamMember = await TeamMember.findOne({...});
  
  if (!teamMember.permissions.canManageVerificationRequests) {
    return 403; // Forbidden
  }
}
// Individual user (not in organization)
else {
  // Only tender creator can approve/reject
  if (!isCreator) {
    return 403; // Forbidden
  }
}
```

---

## Permission Matrix

| Action | Admin | Individual User | Team Leader | Full Access | Limited Access | Viewer |
|--------|-------|----------------|-------------|-------------|----------------|--------|
| **Create Tender** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Edit Tender** | ✅ | ✅ (own) | ✅ | ✅ | ❌ | ❌ |
| **Delete Tender** | ✅ | ✅ (own) | ✅ | ❌ | ❌ | ❌ |
| **View Applications** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Accept/Reject Application** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Approve Verification Request** | ✅ | ✅ (own) | ✅ | ✅ | ❌ | ❌ |
| **Reject Verification Request** | ✅ | ✅ (own) | ✅ | ✅ | ❌ | ❌ |
| **Manage Team** | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |

---

## Use Cases

### Scenario 1: Team Leader Approves Verification Request
```javascript
User: {
  _id: "user123",
  organizationId: "org456",
  role: "issuer"
}

Permissions: {
  canManageVerificationRequests: true // ✅ Team Leader
}

Tender: {
  _id: "tender789",
  organization: "org456"
}

Action: POST /api/verification-requests/:requestId/approve
Result: ✅ 200 OK - Request approved, code sent to bidder
```

### Scenario 2: Limited Access Member Tries to Approve
```javascript
User: {
  _id: "user123",
  organizationId: "org456",
  role: "issuer"
}

Permissions: {
  canManageVerificationRequests: false // ❌ Limited Access
}

Tender: {
  _id: "tender789",
  organization: "org456"
}

Action: POST /api/verification-requests/:requestId/approve
Result: ❌ 403 Forbidden - "You don't have permission to manage verification requests"
```

### Scenario 3: Full Access Member Approves
```javascript
User: {
  _id: "user123",
  organizationId: "org456",
  role: "issuer"
}

Permissions: {
  canManageVerificationRequests: true // ✅ Full Access
}

Tender: {
  _id: "tender789",
  organization: "org456"
}

Action: POST /api/verification-requests/:requestId/approve
Result: ✅ 200 OK - Request approved
```

---

## API Endpoints

### Approve Verification Request
```http
POST /api/verification-requests/:requestId/approve
Authorization: Bearer <token>

Response (Success):
{
  "message": "Verification code request approved and sent to bidder",
  "request": { ... }
}

Response (No Permission):
{
  "message": "Forbidden: You don't have permission to manage verification requests"
}
```

### Reject Verification Request
```http
POST /api/verification-requests/:requestId/reject
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Does not meet requirements"
}

Response (Success):
{
  "message": "Verification code request rejected",
  "request": { ... }
}

Response (No Permission):
{
  "message": "Forbidden: You don't have permission to manage verification requests"
}
```

---

## Activity Logging

### Approve Action
```javascript
{
  organizationId: "org456",
  userId: "user123",
  action: "approve_verification_request",
  targetType: "verification_request",
  targetId: "request789",
  details: {
    tenderId: "tender123",
    tenderTitle: "Construction Project",
    requestedBy: "bidder@example.com"
  },
  timestamp: "2024-01-20T10:30:00Z"
}
```

### Reject Action
```javascript
{
  organizationId: "org456",
  userId: "user123",
  action: "reject_verification_request",
  targetType: "verification_request",
  targetId: "request789",
  details: {
    tenderId: "tender123",
    tenderTitle: "Construction Project",
    requestedBy: "bidder@example.com",
    reason: "Does not meet requirements"
  },
  timestamp: "2024-01-20T10:30:00Z"
}
```

---

## Frontend Integration

### Check Permission
```javascript
// utils/permissions.js

export const canManageVerificationRequests = (user, permissions, tender) => {
  // Admin can always manage
  if (user?.role === 'admin') return true;

  // Individual user (not part of organization)
  if (!user?.organizationId) {
    // Only tender creator can manage
    return tender?.createdBy === user?._id;
  }

  // Team member checks
  if (!permissions) return false;

  // Check if tender belongs to same organization
  if (tender?.organization !== user?.organizationId) {
    return false;
  }

  // Check specific permission
  return permissions.canManageVerificationRequests || false;
};
```

### UI Component Example
```javascript
// components/VerificationRequestList.jsx
import { useAuth } from '../contexts/AuthContext';
import { canManageVerificationRequests } from '../utils/permissions';

const VerificationRequestList = ({ requests, tender }) => {
  const { user, permissions } = useAuth();
  const canManage = canManageVerificationRequests(user, permissions, tender);

  return (
    <div className="verification-requests">
      {requests.map(request => (
        <div key={request._id} className="request-card">
          <h3>{request.requestedBy.name}</h3>
          <p>{request.message}</p>
          <p>Status: {request.status}</p>
          
          {canManage && request.status === 'pending' && (
            <div className="request-actions">
              <button 
                onClick={() => handleApprove(request._id)}
                className="btn-success"
              >
                Approve
              </button>
              <button 
                onClick={() => handleReject(request._id)}
                className="btn-danger"
              >
                Reject
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
```

---

## Error Messages

```javascript
// Team member without permission
"Forbidden: You don't have permission to manage verification requests"

// Not an active team member
"Forbidden: You are not an active team member"

// Wrong organization
"Forbidden: You don't have permission to manage verification requests"

// Individual user trying to manage others' requests
"Forbidden: You can only manage verification requests for your own tenders"
```

---

## Migration Notes

### For Existing Deployments

1. **Database Migration:**
   - No migration needed
   - New permission field has default value `false`
   - Existing team members will have `canManageVerificationRequests: false`

2. **Update Existing Team Members:**
   ```javascript
   // Update Team Leaders
   await TeamMember.updateMany(
     { role: 'team_leader' },
     { $set: { 'permissions.canManageVerificationRequests': true } }
   );
   
   // Update Full Access members (optional)
   await TeamMember.updateMany(
     { 
       'permissions.canAcceptReject': true,
       'permissions.canEditTenders': true
     },
     { $set: { 'permissions.canManageVerificationRequests': true } }
   );
   ```

3. **Frontend Updates:**
   - Add permission check function
   - Update UI to show/hide approve/reject buttons
   - Handle 403 errors gracefully

---

## Testing

### Test Cases

1. **Team Leader can approve:**
   ```bash
   POST /api/verification-requests/:id/approve
   # Expected: 200 OK
   ```

2. **Limited Access cannot approve:**
   ```bash
   POST /api/verification-requests/:id/approve
   # Expected: 403 Forbidden
   ```

3. **Full Access can approve:**
   ```bash
   POST /api/verification-requests/:id/approve
   # Expected: 200 OK
   ```

4. **Viewer cannot approve:**
   ```bash
   POST /api/verification-requests/:id/approve
   # Expected: 403 Forbidden
   ```

5. **Activity logging works:**
   ```bash
   GET /api/activity-logs?action=approve_verification_request
   # Expected: Shows logged activities
   ```

---

## Benefits

✅ **Granular Control** - Team leaders can delegate verification management
✅ **Security** - Only authorized members can approve/reject requests
✅ **Audit Trail** - All actions are logged
✅ **Flexibility** - Can be customized per team member
✅ **Consistency** - Follows same pattern as other permissions

---

## Conclusion

The `canManageVerificationRequests` permission is now fully implemented and integrated with the existing permission system. It provides:

- ✅ Airtight security
- ✅ Flexible team management
- ✅ Complete activity logging
- ✅ Clear error messages
- ✅ Frontend integration support

**The system is production-ready!**

---

**Implemented By:** FSS Development Team
**Date:** 2024
**Version:** 3.0
