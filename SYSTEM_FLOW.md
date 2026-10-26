# FSS Backend System Flow

This document summarizes the backend startup sequence, API request pipeline, and
the main tender-bidding workflow implemented in this repository.

## System overview

```mermaid
flowchart TD
    Env["Environment variables (.env)"] --> Validate["Validate required configuration"]
    Validate --> App["Load Express app"]
    App --> Mongo["Connect to MongoDB"]
    App --> Middleware["Register security, parsing, request-ID, logging, and rate-limit middleware"]
    Middleware --> Routes["Mount API routes"]
    Routes --> Listen["Start HTTP server"]
    Listen --> SupabaseCheck["Check Supabase Storage"]

    Client["Frontend / API client"] --> Request["HTTP request"]
    Request --> Middleware
    Middleware --> RouteMatch{"Health/root or API route?"}
    RouteMatch -->|Health or root| Health["Return health status / welcome response"]
    RouteMatch -->|API| Limiter["Apply general and route-specific rate limits"]
    Limiter --> RouteHandler["Route middleware"]
    RouteHandler --> Auth{"Authentication / role required?"}
    Auth -->|Yes| JWT["Verify bearer JWT and load active user"]
    Auth -->|No| Controller["Controller"]
    JWT --> Access{"Token valid and role allowed?"}
    Access -->|No| AuthError["Return 401 / 403"]
    Access -->|Yes| Controller

    Controller --> MongoOps["Read or update MongoDB models"]
    Controller --> Storage["Upload / delete files in Supabase Storage"]
    Controller --> Email["Send transactional email through SMTP"]
    Controller --> Response["Return JSON response"]
    MongoOps --> Response
    Storage --> Response
    Email --> Response

    RouteMatch -->|No matching route| NotFound["404 not-found middleware"]
    Controller -->|Unhandled error| ErrorHandler["Central error handler"]
    NotFound --> ErrorHandler
```

## User flow

This view follows the people using the platform, from account access through
their main bidder, issuer, team-member, or admin tasks.

```mermaid
flowchart TD
    Start["Open the platform"] --> Account{"New user or existing user?"}
    Account -->|New bidder or issuer| Register["Register with account details and role"]
    Register --> RegisterOTP["Receive registration OTP by email"]
    RegisterOTP --> OTPValid{"OTP valid and not expired?"}
    OTPValid -->|No| RetryOTP["Request or enter a valid OTP"]
    RetryOTP --> RegisterOTP
    OTPValid -->|Yes| VerifiedAccount["Email verified"]
    Account -->|Existing user| Login["Sign in with email and password"]
    VerifiedAccount --> Login

    Login --> Credentials{"Credentials valid and email verified?"}
    Credentials -->|No| LoginError["Show sign-in or email-verification error"]
    LoginError --> Login
    Credentials -->|Yes| TeamAccount{"Organization team member?"}
    TeamAccount -->|Yes| TeamLogin["Enter organization email and select member"]
    TeamLogin --> TeamCredentials{"Member, password, and organization valid?"}
    TeamCredentials -->|No| LoginError
    TeamCredentials -->|Yes| Dashboard["Open role-based workspace"]
    TeamAccount -->|No| Dashboard

    Dashboard --> Role{"User role"}

    Role -->|Bidder| BidderBrowse["Browse and open active tenders"]
    BidderBrowse --> BidderApply["Follow bidder tender application flow"]
    BidderApply --> Track["View own applications and notifications"]
    Track --> Profile["Manage profile or password"]

    Role -->|Issuer| IssuerWorkspace["Manage own or organization tenders"]
    IssuerWorkspace --> TenderAction{"Tender task"}
    TenderAction -->|Create or update| TenderForm["Enter tender details and upload tender documents"]
    TenderForm --> TenderSaved["Save tender; notify issuer"]
    TenderSaved --> IssuerWorkspace
    TenderAction -->|Review submissions| ReviewApps["View applications for accessible tenders"]
    ReviewApps --> Decide["Accept, reject, or update status with comment"]
    Decide --> ApplicantNotice["Applicant receives email and in-app status notification"]
    ApplicantNotice --> IssuerWorkspace
    TenderAction -->|Organization and team| TeamManagement{"Team leader?"}
    TeamManagement -->|Yes| Invite["Invite member and assign permissions"]
    Invite --> AcceptInvite["Member validates invitation and sets password"]
    AcceptInvite --> TeamLogin
    TeamManagement -->|No| PermissionCheck["Use organization features allowed by permissions"]
    PermissionCheck --> IssuerWorkspace

    Role -->|Admin| AdminTasks["Manage users and platform-wide records"]
    AdminTasks --> AdminActions["Review applications, tenders, and verification requests"]

    Dashboard --> Shared["All signed-in roles can view notifications and update profile"]
```

## Bidder tender application flow

Code verification is required only when the tender's `verificationCode` field is
set. Verification requests are auto-approved when created; the issuer/admin
approval routes still exist for managing requests.

```mermaid
flowchart TD
    Bidder["Bidder"] --> Browse["Browse or open a tender"]
    Browse --> API["GET /api/tenders or /api/tenders/:id"]
    API --> Tender["Load tender from MongoDB"]
    Tender --> Active{"Tender active and before deadline?"}
    Active -->|No| Closed["Do not allow a new application"]
    Active -->|Yes| Requires{"Tender requires a verification code?"}

    Requires -->|No| Apply["Submit application"]
    Requires -->|Yes| Status["GET /api/verification-code/status/:tenderId"]
    Status --> Existing{"Already applied?"}
    Existing -->|Yes| AlreadyApplied["Show already-applied state"]
    Existing -->|No| CodeExists{"Unused approved code exists?"}
    CodeExists -->|Yes| EnterCode["Enter emailed code"]
    CodeExists -->|No| RequestCode["POST /api/verification-code/request/:tenderId"]
    RequestCode --> RequestChecks["Check tender is active and no application or unused code exists"]
    RequestChecks --> Generate["Generate code and save approved request in MongoDB"]
    Generate --> Notify["Email code via SMTP and create in-app notification"]
    Notify --> EnterCode

    EnterCode --> Verify["POST /api/verification-code/verify/:tenderId"]
    Verify --> VerifyCheck{"Code matches this bidder's unused approved request?"}
    VerifyCheck -->|No| Invalid["Return invalid-code response"]
    VerifyCheck -->|Yes| MarkUsed["Set codeUsed = true"]
    MarkUsed --> Apply

    Apply --> ApplyAPI["POST /api/applications/:tenderId"]
    ApplyAPI --> ApplyGuard{"Tender valid, required fields present, and verification satisfied?"}
    ApplyGuard -->|No| ApplyError["Return validation, closed-tender, or verification error"]
    ApplyGuard -->|Yes| Uploads["Upload submitted documents to Supabase Storage"]
    Uploads --> SaveApplication["Save application and link it to tender in MongoDB"]
    SaveApplication --> ApplyNotices["Email submission receipt and notify bidder and tender owner"]
    ApplyNotices --> Applied["Return created application (201)"]
```

## Main API areas and data

| API area | Purpose | Main MongoDB models / services |
| --- | --- | --- |
| `/api/auth` | Registration, OTP verification, login, profile, password recovery, and admin user management | `User`, SMTP email |
| `/api/team-auth` | Shared-email team-member lookup and team login | `User`, `TeamMember` |
| `/api/tenders` | Public tender listing/details; issuer/admin tender creation and management | `Tender`, `Application`, Supabase Storage |
| `/api/applications` | Bidder submissions and issuer/admin review or status changes | `Application`, `Tender`, `Notification`, Supabase Storage, SMTP |
| `/api/verification-code` | Request, verify, and inspect bidder codes; issuer/admin request management | `VerificationCodeRequest`, `Tender`, `Application`, `Notification`, SMTP |
| `/api/organizations` | Organization details, statistics, updates, and deactivation | `Organization`, organization/team permissions |
| `/api/team-members` | Invitations, team membership, and permissions | `TeamInvitation`, `TeamMember`, `User`, SMTP |
| `/api/notifications` | List, read, and clear the current user's notifications | `Notification` |
| `/api/activity-logs` | Organization, member, and resource activity reports | `ActivityLog` |
| `/api/issuer` | Bidders associated with an issuer's tenders | `Tender`, `Application` |
| `/api/files` | Authenticated file upload and download redirect endpoints | Supabase Storage |

MongoDB stores users, tenders, applications, organizations, team memberships and
invitations, verification-code requests, notifications, and activity logs.
Tender and application documents are uploaded to the `tenderDocs` Supabase
Storage bucket; MongoDB records their metadata and URLs. SMTP is used for
registration/password OTPs and tender-related notifications.

## Request and access notes

- `src/server.js` loads environment configuration, validates required variables,
  imports the app, starts listening, and runs the Supabase connectivity check.
- The Express app applies security and request-processing middleware before
  mounting API routes. A general rate limiter covers routes, with stricter
  limits on selected authentication and OTP endpoints.
- Protected routes validate a bearer JWT, load an active user, and may apply
  role or organization/team permission checks before calling a controller.
- Unknown routes go through the 404 middleware; errors reaching the end of the
  middleware chain are formatted by the central error handler.
- The implemented bidder application route is
  `POST /api/applications/:tenderId` (not a path ending in `/apply`).
