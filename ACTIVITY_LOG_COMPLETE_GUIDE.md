# Activity Log - Complete Guide

## Overview
This document provides a complete guide to the activity logging system implemented in the FSS (Federal Supplier System) application.

---

## Logged Actions

### Tender Operations
| Action | Description | Logged When |
|--------|-------------|-------------|
| `create_tender` | Tender created | Team member creates a tender |
| `update_tender` | Tender updated | Team member edits a tender |
| `delete_tender` | Tender deleted | Team member deletes a tender |

### Application Operations
| Action | Description | Logged When |
|--------|-------------|-------------|
| `accept_application` | Application accepted | Team member accepts an application |
| `reject_application` | Application rejected | Team member rejects an application |
| `update_application` | Application status changed | Team member updates application status |

### Verification Request Operations
| Action | Description | Logged When |
|--------|-------------|-------------|
| `request_verification_code` | Verification code requested | Bidder requests verification code |
| `approve_verification_request` | Request approved | Team member approves verification request |
| `reject_verification_request` | Request rejected | Team member rejects verification request |

### Team Management Operations
| Action | Description | Logged When |
|--------|-------------|-------------|
| `add_member` | Member added/invited | Team leader invites a new member |
| `remove_member` | Member removed | Team leader removes a member |
| `update_permissions` | Permissions changed | Team leader updates member permissions |

---

## Activity Log Structure

### Database Schema
```javascript
{
  organizationId: ObjectId,      // Organization this activity belongs to
  userId: ObjectId,              // User who performed the action
  action: String,                // Action type (see above)
  targetType: String,            // Type of target (tender, application, etc.)
  targetId: ObjectId,            // ID of the target resource
  details: Object,               // Action-specific details
  ipAddress: String,             // IP address of the user
  userAgent: String,             // Browser/client information
  timestamp: Date                // When the action occurred
}
```

### Example Log Entries

#### Create Tender
```javascript
{
  organizationId: "68f61072cde88d96734590ba",
  userId: "68f6209600e000f8e7f478c1",
  action: "create_tender",
  targetType: "tender",
  targetId: "68f6209700e000f8e7f478c3",
  details: {
    tenderTitle: "Construction Project",
    category: "construction",
    deadline: "2024-12-31T00:00:00.000Z"
  },
  ipAddress: "192.168.1.100",
  userAgent: "Mozilla/5.0...",
  timestamp: "2024-01-20T10:30:00.000Z"
}
```

#### Update Tender
```javascript
{
  organizationId: "68f61072cde88d96734590ba",
  userId: "68f6209600e000f8e7f478c1",
  action: "update_tender",
  targetType: "tender",
  targetId: "68f6209700e000f8e7f478c3",
  details: {
    tenderTitle: "Construction Project",
    updatedFields: ["title", "description", "deadline"]
  },
  ipAddress: "192.168.1.100",
  userAgent: "Mozilla/5.0...",
  timestamp: "2024-01-20T11:00:00.000Z"
}
```

#### Delete Tender
```javascript
{
  organizationId: "68f61072cde88d96734590ba",
  userId: "68f6209600e000f8e7f478c1",
  action: "delete_tender",
  targetType: "tender",
  targetId: "68f6209700e000f8e7f478c3",
  details: {
    tenderTitle: "Construction Project",
    category: "construction"
  },
  ipAddress: "192.168.1.100",
  userAgent: "Mozilla/5.0...",
  timestamp: "2024-01-20T12:00:00.000Z"
}
```

#### Accept Application
```javascript
{
  organizationId: "68f61072cde88d96734590ba",
  userId: "68f6209600e000f8e7f478c1",
  action: "accept_application",
  targetType: "application",
  targetId: "68f6209800e000f8e7f478c5",
  details: {
    applicationId: "68f6209800e000f8e7f478c5",
    tenderId: "68f6209700e000f8e7f478c3",
    tenderTitle: "Construction Project",
    newStatus: "accepted",
    comment: null
  },
  ipAddress: "192.168.1.100",
  userAgent: "Mozilla/5.0...",
  timestamp: "2024-01-20T13:00:00.000Z"
}
```

#### Request Verification Code
```javascript
{
  organizationId: "68f61072cde88d96734590ba",
  userId: "68f6209900e000f8e7f478c7",
  action: "request_verification_code",
  targetType: "verification_request",
  targetId: "68f6209a00e000f8e7f478c9",
  details: {
    tenderId: "68f6209700e000f8e7f478c3",
    tenderTitle: "Construction Project",
    requestedBy: "bidder@example.com",
    message: "I would like to apply for this tender"
  },
  ipAddress: "192.168.1.101",
  userAgent: "Mozilla/5.0...",
  timestamp: "2024-01-20T14:00:00.000Z"
}
```

#### Approve Verification Request
```javascript
{
  organizationId: "68f61072cde88d96734590ba",
  userId: "68f6209600e000f8e7f478c1",
  action: "approve_verification_request",
  targetType: "verification_request",
  targetId: "68f6209a00e000f8e7f478c9",
  details: {
    tenderId: "68f6209700e000f8e7f478c3",
    tenderTitle: "Construction Project",
    requestedBy: "bidder@example.com",
    approvedBy: "teamleader@example.com"
  },
  ipAddress: "192.168.1.100",
  userAgent: "Mozilla/5.0...",
  timestamp: "2024-01-20T14:30:00.000Z"
}
```

#### Reject Verification Request
```javascript
{
  organizationId: "68f61072cde88d96734590ba",
  userId: "68f6209600e000f8e7f478c1",
  action: "reject_verification_request",
  targetType: "verification_request",
  targetId: "68f6209a00e000f8e7f478c9",
  details: {
    tenderId: "68f6209700e000f8e7f478c3",
    tenderTitle: "Construction Project",
    requestedBy: "bidder@example.com",
    rejectedBy: "teamleader@example.com",
    reason: "Does not meet requirements"
  },
  ipAddress: "192.168.1.100",
  userAgent: "Mozilla/5.0...",
  timestamp: "2024-01-20T14:30:00.000Z"
}
```

#### Add Team Member
```javascript
{
  organizationId: "68f61072cde88d96734590ba",
  userId: "68f6209600e000f8e7f478c1",
  action: "add_member",
  targetType: "team_member",
  targetId: null,
  details: {
    memberName: "John Doe",
    memberEmail: "john@example.com",
    invitationSent: true
  },
  ipAddress: "192.168.1.100",
  userAgent: "Mozilla/5.0...",
  timestamp: "2024-01-20T15:00:00.000Z"
}
```

#### Update Permissions
```javascript
{
  organizationId: "68f61072cde88d96734590ba",
  userId: "68f6209600e000f8e7f478c1",
  action: "update_permissions",
  targetType: "team_member",
  targetId: "68f6209b00e000f8e7f478cb",
  details: {
    oldPermissions: {
      canCreateTenders: true,
      canEditTenders: false,
      canDeleteTenders: false,
      canViewApplications: true,
      canAcceptReject: false,
      canManageVerificationRequests: false,
      canManageTeam: false
    },
    newPermissions: {
      canCreateTenders: true,
      canEditTenders: true,
      canDeleteTenders: false,
      canViewApplications: true,
      canAcceptReject: true,
      canManageVerificationRequests: true,
      canManageTeam: false
    }
  },
  ipAddress: "192.168.1.100",
  userAgent: "Mozilla/5.0...",
  timestamp: "2024-01-20T16:00:00.000Z"
}
```

---

## API Endpoints

### Get Activity Logs
```http
GET /api/activity-logs
Authorization: Bearer <token>

Query Parameters:
- organizationId: Filter by organization (required for non-admins)
- action: Filter by action type
- userId: Filter by user
- startDate: Filter by start date
- endDate: Filter by end date
- page: Page number (default: 1)
- limit: Items per page (default: 50)

Response:
{
  "activities": [
    {
      "_id": "...",
      "organizationId": "...",
      "userId": {
        "_id": "...",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "action": "create_tender",
      "targetType": "tender",
      "targetId": "...",
      "details": { ... },
      "ipAddress": "192.168.1.100",
      "userAgent": "Mozilla/5.0...",
      "timestamp": "2024-01-20T10:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 50,
    "pages": 3
  }
}
```

### Get Team Member Activity
```http
GET /api/team-members/:memberId/activity
Authorization: Bearer <token>

Query Parameters:
- action: Filter by action type
- startDate: Filter by start date
- endDate: Filter by end date
- page: Page number (default: 1)
- limit: Items per page (default: 50)

Response:
{
  "activities": [ ... ],
  "pagination": { ... }
}
```

---

## Frontend Integration

### Fetch Activity Logs
```javascript
// services/activityLog.js
import api from './api';

export const activityLogAPI = {
  // Get all activity logs for organization
  getAll: (organizationId, filters = {}) => {
    const params = new URLSearchParams({
      organizationId,
      ...filters
    });
    return api.get(`/activity-logs?${params}`);
  },

  // Get activity logs for specific member
  getMemberActivity: (memberId, filters = {}) => {
    const params = new URLSearchParams(filters);
    return api.get(`/team-members/${memberId}/activity?${params}`);
  },

  // Get activity logs by action type
  getByAction: (organizationId, action) => {
    return api.get(`/activity-logs?organizationId=${organizationId}&action=${action}`);
  },

  // Get activity logs by date range
  getByDateRange: (organizationId, startDate, endDate) => {
    return api.get(
      `/activity-logs?organizationId=${organizationId}&startDate=${startDate}&endDate=${endDate}`
    );
  }
};
```

### Activity Log Component
```javascript
// components/ActivityLog.jsx
import { useState, useEffect } from 'react';
import { activityLogAPI } from '../services/activityLog';
import { useAuth } from '../contexts/AuthContext';

const ActivityLog = () => {
  const { user } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: '',
    startDate: '',
    endDate: '',
    page: 1,
    limit: 50
  });

  useEffect(() => {
    fetchActivities();
  }, [filters]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const response = await activityLogAPI.getAll(
        user.organizationId,
        filters
      );
      setActivities(response.data.activities);
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionLabel = (action) => {
    const labels = {
      create_tender: 'Created Tender',
      update_tender: 'Updated Tender',
      delete_tender: 'Deleted Tender',
      accept_application: 'Accepted Application',
      reject_application: 'Rejected Application',
      request_verification_code: 'Requested Verification Code',
      approve_verification_request: 'Approved Verification Request',
      reject_verification_request: 'Rejected Verification Request',
      add_member: 'Added Team Member',
      remove_member: 'Removed Team Member',
      update_permissions: 'Updated Permissions'
    };
    return labels[action] || action;
  };

  const getActionColor = (action) => {
    if (action.includes('create') || action.includes('add') || action.includes('approve')) {
      return 'text-green-600';
    }
    if (action.includes('delete') || action.includes('remove') || action.includes('reject')) {
      return 'text-red-600';
    }
    if (action.includes('update')) {
      return 'text-blue-600';
    }
    return 'text-gray-600';
  };

  return (
    <div className="activity-log">
      <h2>Activity Log</h2>

      {/* Filters */}
      <div className="filters">
        <select
          value={filters.action}
          onChange={(e) => setFilters({ ...filters, action: e.target.value })}
        >
          <option value="">All Actions</option>
          <option value="create_tender">Create Tender</option>
          <option value="update_tender">Update Tender</option>
          <option value="delete_tender">Delete Tender</option>
          <option value="accept_application">Accept Application</option>
          <option value="reject_application">Reject Application</option>
          <option value="approve_verification_request">Approve Verification</option>
          <option value="reject_verification_request">Reject Verification</option>
        </select>

        <input
          type="date"
          value={filters.startDate}
          onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
          placeholder="Start Date"
        />

        <input
          type="date"
          value={filters.endDate}
          onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
          placeholder="End Date"
        />
      </div>

      {/* Activity List */}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="activity-list">
          {activities.map(activity => (
            <div key={activity._id} className="activity-item">
              <div className="activity-header">
                <span className={`action ${getActionColor(activity.action)}`}>
                  {getActionLabel(activity.action)}
                </span>
                <span className="timestamp">
                  {new Date(activity.timestamp).toLocaleString()}
                </span>
              </div>

              <div className="activity-body">
                <p>
                  <strong>{activity.userId.name}</strong>
                  {' '}({activity.userId.email})
                </p>

                {activity.details && (
                  <div className="activity-details">
                    {activity.details.tenderTitle && (
                      <p>Tender: {activity.details.tenderTitle}</p>
                    )}
                    {activity.details.reason && (
                      <p>Reason: {activity.details.reason}</p>
                    )}
                    {activity.details.requestedBy && (
                      <p>Requested By: {activity.details.requestedBy}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActivityLog;
```

---

## Logging Conditions

### When Logs Are Created

**Tenders:**
- ✅ Logged if tender belongs to an organization
- ❌ Not logged for individual users (no organizationId)

**Applications:**
- ✅ Logged if user belongs to an organization
- ❌ Not logged for individual users

**Verification Requests:**
- ✅ Logged if tender belongs to an organization
- ❌ Not logged for individual tenders

**Team Management:**
- ✅ Always logged (only organizations have teams)

---

## Benefits

### For Organizations
- ✅ **Full Audit Trail** - Track all actions by team members
- ✅ **Accountability** - Know who did what and when
- ✅ **Compliance** - Meet regulatory requirements
- ✅ **Security** - Detect unauthorized actions
- ✅ **Analytics** - Understand team activity patterns

### For Team Leaders
- ✅ **Monitor Activity** - See what team members are doing
- ✅ **Track Changes** - Review tender and application changes
- ✅ **Identify Issues** - Spot problems quickly
- ✅ **Performance Review** - Evaluate team member contributions

### For Admins
- ✅ **System Overview** - See all activity across organizations
- ✅ **Troubleshooting** - Debug issues with detailed logs
- ✅ **Security Monitoring** - Detect suspicious activity
- ✅ **Reporting** - Generate activity reports

---

## Best Practices

### 1. Regular Review
- Review activity logs weekly
- Look for unusual patterns
- Verify important actions

### 2. Retention Policy
- Keep logs for at least 1 year
- Archive old logs for compliance
- Implement log rotation

### 3. Access Control
- Only team leaders and admins can view logs
- Logs are organization-specific
- No cross-organization access

### 4. Privacy
- Logs include IP addresses for security
- User agents help identify devices
- Sensitive data is not logged

---

## Summary

✅ **Complete Coverage** - All important actions are logged
✅ **Detailed Information** - Logs include all relevant details
✅ **Organization-Specific** - Logs are isolated by organization
✅ **Easy to Query** - Flexible filtering and pagination
✅ **Frontend Ready** - API endpoints and components provided

---

**Implemented By:** FSS Development Team
**Date:** 2024
**Version:** 4.0 (Complete Activity Logging)
