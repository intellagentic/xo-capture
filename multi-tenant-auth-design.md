# XO Capture -- Multi-Tenant Auth & User Management Design

## Overview
Multi-tenant authentication model with self-service user management for partner organizations.

## Account Hierarchy

### Super Admin (Intellagentic)
- Platform owner -- sees all accounts, all partners, all clients
- Can create partner accounts, add first users, manage anything
- Users: Ken Scott, Alan Moore, Richie Saville, Vamsi Nama

### Partner Admin
- Manages users within their partner account
- Sees all clients assigned to their partner
- Can invite partner users, assign clients to users, remove users
- Example: Joe Lopez (Intellistack CSO) invites and manages his sales team

### Partner User
- Scoped to specifically assigned clients only
- Cannot see other partner users' clients
- Cannot invite or manage users
- Example: Sales rep sees only their 3 assigned clients

### Client Contact
- Read-only access to a single client workspace
- Sees results, brief, deck -- no admin, no client list
- Example: Edem Brampah sees FC Dynamics workspace only

## Onboarding Flow
1. Intellagentic super admin creates partner account (e.g., "Intellistack")
2. Super admin adds initial users (Aled Miles, Joe Lopez) -- Aled as partner user, Joe as partner admin
3. Invite emails sent with login links
4. Joe (partner admin) invites his sales reps -- self-service
5. Joe assigns specific clients to each rep
6. Reps log in and see only their assigned clients

## Database Schema Changes

### accounts table
- id UUID PRIMARY KEY
- name TEXT NOT NULL (e.g., "Intellagentic", "Intellistack")
- type TEXT NOT NULL (platform, partner)
- partner_id UUID REFERENCES partners(id) -- links to existing partners table
- created_at TIMESTAMP
- updated_at TIMESTAMP

### users table changes
- ADD account_id UUID REFERENCES accounts(id)
- ADD account_role TEXT (super_admin, partner_admin, partner_user, client_contact)
- DEPRECATE existing role column (migrate to account_role)
- ADD invited_by UUID REFERENCES users(id)
- ADD invited_at TIMESTAMP

### user_client_assignments table (new)
- id UUID PRIMARY KEY
- user_id UUID REFERENCES users(id)
- client_id UUID REFERENCES clients(id)
- assigned_by UUID REFERENCES users(id)
- assigned_at TIMESTAMP DEFAULT NOW()
- UNIQUE(user_id, client_id)

## API Endpoints

### Account Management (super admin only)
- POST /accounts -- create partner account
- GET /accounts -- list all accounts
- PUT /accounts/{id} -- update account
- DELETE /accounts/{id} -- deactivate account

### User Management (super admin + partner admin)
- POST /accounts/{id}/users -- invite user to account
- GET /accounts/{id}/users -- list users in account
- PUT /users/{id} -- update user role
- DELETE /users/{id} -- deactivate user
- POST /users/{id}/resend-invite -- resend invite email

### Client Assignment (super admin + partner admin)
- POST /users/{id}/clients -- assign client(s) to user
- GET /users/{id}/clients -- list user's assigned clients
- DELETE /users/{id}/clients/{clientId} -- remove assignment

## Frontend Changes

### Super Admin View
- New "Accounts" page in sidebar (admin only)
- Account list with user counts, client counts
- Click into account to manage users and assignments
- "Invite User" modal with email, name, role selection

### Partner Admin View
- "Team" page in sidebar (partner admin only)
- List of users in their account
- "Invite Team Member" button -- email invite flow
- Client assignment UI -- drag/drop or checkbox matrix
- User activity log (who logged in when)

### Partner User View
- "My Clients" -- only shows assigned clients
- No team management, no account settings
- Standard workspace access (enrich, results, brief, deck)

### Client Contact View
- Single workspace -- no client list, no sidebar nav for other clients
- Read-only results, brief, deck with download buttons
- No enrich, no data upload, no configuration

## Invite Email Flow
1. Admin clicks "Invite User" -- enters email, name, role
2. System creates user record with status "invited"
3. Email sent with magic link (30-day expiry)
4. User clicks link -- sets password or connects Google OAuth
5. User status changes to "active"
6. If user doesn't accept within 30 days, invite expires -- admin can resend

## Migration Path
- Create Intellagentic account (type: platform)
- Migrate existing admin users to Intellagentic account with super_admin role
- Create partner accounts for existing partners
- Migrate existing partner users to their accounts
- Existing client list visibility unchanged until assignments are configured
- Partner admins see all partner clients by default (backward compatible)

## Security Considerations
- JWT includes account_id and account_role
- All API endpoints validate account scope -- partner users cannot access clients outside their assignments
- Super admins bypass all scope checks
- Partner admins bypass assignment checks for their own account's clients
- Invite links are single-use, time-limited
- Account deactivation immediately revokes all user sessions

## Phase Plan
- Phase 1: accounts table + user account_id + account_role migration
- Phase 2: User invite flow (email + magic link)
- Phase 3: Client assignment model + scoped visibility
- Phase 4: Partner admin self-service UI (Team page)
- Phase 5: Client contact read-only workspace

## Phase 6: Two-Factor Authentication (2FA/MFA)
- SMS-based OTP via AWS SNS for login verification
- Optional per-account enforcement (partner admin can require 2FA for their team)
- Fallback: authenticator app (TOTP) for users who prefer it
- Requires: AWS SNS SMS production access, 10DLC registration for US sending, sender ID for UK
- Prerequisite: SES production access (Phase 2 invite emails) must be live first
