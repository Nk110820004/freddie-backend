# API Routes Documentation

This document lists all available API routes in the Freddie Backend, including their HTTP methods, full paths, and required authentication/roles.

## Public Routes (No Authentication Required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/ping` | Health check endpoint |
| GET | `/api/health` | Detailed health status |
| GET | `/admin` | Redirect to admin login |
| GET | `/user` | Redirect to user login |
| POST | `/api/billing/webhook` | Razorpay webhook (public) |
| GET | `/api/integrations/google/auth-url` | Google OAuth auth URL |
| GET | `/api/integrations/google/callback` | Google OAuth callback |
| POST | `/api/integrations/whatsapp/webhook` | WhatsApp webhook |

## Authentication Routes (`/api/auth`)

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| POST | `/api/auth/admin/login` | No | Admin login |
| POST | `/api/auth/user/login` | No | User login |
| POST | `/api/auth/login` | No | Generic user login |
| POST | `/api/auth/register` | No | User registration |
| POST | `/api/auth/two-factor/verify` | No | 2FA verification |
| POST | `/api/auth/logout` | Yes | User logout |
| GET | `/api/auth/me` | Yes | Get current user info |
| POST | `/api/auth/refresh` | No | Refresh access token |
| POST | `/api/auth/validate-password` | No | Validate password strength |

## User Routes (`/api/user`)

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| GET | `/api/user/me` | Yes | Get current user profile |
| PUT | `/api/user/profile` | Yes | Update user profile |
| GET | `/api/user/outlets` | Yes | Get user's outlets |
| GET | `/api/user/reviews` | Yes | Get user's outlet reviews |
| GET | `/api/user/stats` | Yes | Get user dashboard stats |
| GET | `/api/user/google-oauth-url` | Yes | Get Google OAuth URL |
| GET | `/api/user/google-callback` | No | Google OAuth callback |
| POST | `/api/user/connect-google` | Yes | Connect Google account |

## Users Management Routes (`/api/users`)

| Method | Path | Auth Required | Role Required | Description |
|--------|------|---------------|---------------|-------------|
| POST | `/api/users/` | Yes | SUPER_ADMIN | Create admin user |
| PUT | `/api/users/:id` | Yes | SUPER_ADMIN | Update user |
| DELETE | `/api/users/:id` | Yes | SUPER_ADMIN | Delete user |
| GET | `/api/users/` | Yes | ADMIN+ | Get all users |
| GET | `/api/users/:id` | Yes | ADMIN+ | Get user by ID |
| POST | `/api/users/:id/twofa/enroll` | Yes | ADMIN+ | Enroll 2FA |
| POST | `/api/users/:id/twofa/verify` | Yes | ADMIN+ | Verify 2FA enrollment |
| POST | `/api/users/me/change-password` | Yes | Any | Change own password |
| GET | `/api/users/me/profile` | Yes | Any | Get own profile |
| PUT | `/api/users/me/profile` | Yes | Any | Update own profile |

## Admin Routes (`/api/admin`)

| Method | Path | Auth Required | Role Required | Description |
|--------|------|---------------|---------------|-------------|
| POST | `/api/admin/users` | Yes | ADMIN+ | Create new user |
| GET | `/api/admin/users` | Yes | ADMIN+ | Get all users |
| PUT | `/api/admin/users/:userId/role` | Yes | ADMIN+ | Update user role |
| PUT | `/api/admin/users/:userId/google-email` | Yes | ADMIN+ | Update user Google email |
| DELETE | `/api/admin/users/:userId` | Yes | ADMIN+ | Delete user |
| POST | `/api/admin/users/:userId/outlets` | Yes | ADMIN+ | Assign outlets to user |
| POST | `/api/admin/outlets` | Yes | ADMIN+ | Onboard new outlet |
| POST | `/api/admin/outlets/:outletId/subscription` | Yes | ADMIN+ | Update outlet subscription |
| GET | `/api/admin/outlets` | Yes | ADMIN+ | Get all outlets |
| GET | `/api/admin/reviews/manual-queue` | Yes | ADMIN+ | Get manual review queue |
| POST | `/api/admin/reviews/:reviewId/manual-reply` | Yes | ADMIN+ | Submit manual reply |
| POST | `/api/admin/outlets/:outletId/google/connect-link` | Yes | ADMIN+ | Generate Google connect link for outlet |
| GET | `/api/admin/outlets/:outletId/google/locations` | Yes | ADMIN+ | Get Google locations for outlet |
| POST | `/api/admin/outlets/:outletId/google/link-location` | Yes | ADMIN+ | Link Google location to outlet |

## Admin Users Routes (`/api/admin/users`)

| Method | Path | Auth Required | Role Required | Description |
|--------|------|---------------|---------------|-------------|
| POST | `/api/admin/users/` | Yes | SUPER_ADMIN | Create admin user |
| GET | `/api/admin/users/` | Yes | ADMIN+ | Get all users |
| PUT | `/api/admin/users/:id` | Yes | SUPER_ADMIN | Update user |
| DELETE | `/api/admin/users/:id` | Yes | SUPER_ADMIN | Delete user |

## Outlets Routes (`/api/outlets`)

| Method | Path | Auth Required | Role Required | Description |
|--------|------|---------------|---------------|-------------|
| GET | `/api/outlets/` | Yes | ADMIN+ | Get all outlets |
| GET | `/api/outlets/:id` | Yes | ADMIN+ | Get outlet by ID |
| GET | `/api/outlets/:id/health` | Yes | ADMIN+ | Get outlet health metrics |
| GET | `/api/outlets/:id/reviews` | Yes | ADMIN+ | Get outlet reviews |
| POST | `/api/outlets/` | Yes | SUPER_ADMIN | Create outlet |
| PUT | `/api/outlets/:id` | Yes | SUPER_ADMIN | Update outlet |
| DELETE | `/api/outlets/:id` | Yes | SUPER_ADMIN | Delete outlet |

## Reviews Routes (`/api/reviews`)

| Method | Path | Auth Required | Role Required | Description |
|--------|------|---------------|---------------|-------------|
| GET | `/api/reviews/` | Yes | ADMIN+ | Get all reviews |
| GET | `/api/reviews/:id` | Yes | ADMIN+ | Get review by ID |
| GET | `/api/reviews/outlet/:outletId` | Yes | ADMIN+ | Get reviews for outlet |
| PATCH | `/api/reviews/:id/status` | Yes | ADMIN+ | Update review status |
| POST | `/api/reviews/:id/manual-reply` | Yes | ADMIN+ | Add manual reply |
| DELETE | `/api/reviews/:id` | Yes | SUPER_ADMIN | Delete review |

## Dashboard Routes (`/api/dashboard`)

| Method | Path | Auth Required | Role Required | Description |
|--------|------|---------------|---------------|-------------|
| GET | `/api/dashboard/metrics` | Yes | ADMIN+ | Get dashboard metrics |
| GET | `/api/dashboard/activities` | Yes | ADMIN+ | Get recent activities |

## Billing Routes (`/api/billing`)

| Method | Path | Auth Required | Role Required | Description |
|--------|------|---------------|---------------|-------------|
| POST | `/api/billing/create-order` | Yes | Any | Create payment order |
| POST | `/api/billing/verify-payment` | Yes | Any | Verify payment |
| GET | `/api/billing/outlet/:outletId` | Yes | ADMIN+ | Get billing by outlet |
| GET | `/api/billing/stats/summary` | Yes | ADMIN+ | Get billing statistics |
| GET | `/api/billing/trials/expiring` | Yes | ADMIN+ | Get expiring trials |
| GET | `/api/billing/overdue` | Yes | ADMIN+ | Get overdue subscriptions |
| PATCH | `/api/billing/outlet/:outletId/status` | Yes | SUPER_ADMIN | Update billing status |

## Payment Routes (`/api/payments`)

| Method | Path | Auth Required | Role Required | Description |
|--------|------|---------------|---------------|-------------|
| POST | `/api/payments/create-order` | Yes | ADMIN+ | Create Razorpay order |
| POST | `/api/payments/verify-payment` | Yes | ADMIN+ | Verify payment |

## Integrations Routes (`/api/integrations`)

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| GET | `/api/integrations/google/auth-url` | No | Google OAuth auth URL (supports token param) |
| GET | `/api/integrations/google/callback` | No | Google OAuth callback |
| GET | `/api/integrations/google/locations` | Yes | Get GMB locations (legacy) |
| POST | `/api/integrations/whatsapp/test` | Yes | Send test WhatsApp message |
| POST | `/api/integrations/openai/generate-reply` | No | Generate AI reply |

## RBAC Routes (`/api/rbac`)

| Method | Path | Auth Required | Role Required | Description |
|--------|------|---------------|---------------|-------------|
| GET | `/api/rbac/users` | Yes | Any | Get admin users |
| POST | `/api/rbac/user/role` | Yes | Any | Update user role |
| POST | `/api/rbac/invite` | Yes | SUPER_ADMIN | Invite user |
| POST | `/api/rbac/user/twofa` | Yes | Any | Toggle 2FA |
| DELETE | `/api/rbac/user/:id` | Yes | Any | Delete user |
| GET | `/api/rbac/roles` | Yes | SUPER_ADMIN | Get roles |
| POST | `/api/rbac/users/:userId/role` | Yes | SUPER_ADMIN | Assign role |

## Security Routes (`/api/security`)

| Method | Path | Auth Required | Role Required | Description |
|--------|------|---------------|---------------|-------------|
| GET | `/api/security/ips` | Yes | SUPER_ADMIN | Get IP allowlist |
| POST | `/api/security/ips` | Yes | SUPER_ADMIN | Add IP to allowlist |
| DELETE | `/api/security/ips/:id` | Yes | SUPER_ADMIN | Remove IP from allowlist |
| PATCH | `/api/security/ips/:id/toggle` | Yes | SUPER_ADMIN | Toggle IP active status |
| GET | `/api/security/apikeys` | Yes | SUPER_ADMIN | Get API keys |
| POST | `/api/security/apikeys` | Yes | SUPER_ADMIN | Create API key |
| POST | `/api/security/apikeys/:id/rotate` | Yes | SUPER_ADMIN | Rotate API key |
| POST | `/api/security/apikeys/:id/revoke` | Yes | SUPER_ADMIN | Revoke API key |

## Audit Routes (`/api/audit-logs`)

| Method | Path | Auth Required | Role Required | Description |
|--------|------|---------------|---------------|-------------|
| GET | `/api/audit-logs/` | Yes | SUPER_ADMIN | Get audit logs |

## Notes

- **Auth Required**: Indicates if authentication is needed
- **Role Required**: 
  - `Any` = Any authenticated user
  - `ADMIN+` = ADMIN or SUPER_ADMIN role
  - `SUPER_ADMIN` = Only SUPER_ADMIN role
- All routes are prefixed with `/api` except the redirect routes
- Some routes have overlapping functionality (e.g., user management in multiple places)
- The backend is running on `http://localhost:3000`