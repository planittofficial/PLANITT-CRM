# Leave Management

This document describes the leave management feature added to Planitt CRM.

## Feature Scope

- Leave request creation with type, start and end dates, reason, and optional attachments.
- Manager assignment with fallback to the department head when no direct manager exists.
- Leave approval workflow for managers and leadership roles.
- Leave request comments and discussion thread for approvers and requesters.
- Status transitions: `PENDING`, `APPROVED`, `REJECTED`, `MORE_INFORMATION`, `ALTERNATIVE_SUGGESTED`, `CANCELLED`.
- Search and status filter support on the leave request list page.
- Real-time notifications for leave request events.

## Backend APIs

- `GET /api/leaves/types` - List available leave types.
- `POST /api/leaves` - Create a new leave request.
- `GET /api/leaves` - List leave requests accessible to the current user.
- `GET /api/leaves/:id` - Retrieve leave request details.
- `PUT /api/leaves/:id` - Update a leave request or cancel it.
- `PUT /api/leaves/:id/status` - Change leave status (approval, rejection, more info, etc.).
- `POST /api/leaves/:id/comments` - Add a comment to a leave request.
- `POST /api/leaves/attachments` - Upload a leave supporting document.

## Frontend Flows

- `/leaves` - Leave dashboard and request list with filters and search.
- `/leaves/new` - Leave application form.
- `/leaves/[id]` - Leave detail and review page.

## Notes

- Leave requests are scoped based on role:
  - Employees can view/create their own requests.
  - Managers can view/manage requests assigned to them.
  - Admins and superadmins can view and manage all requests.
- Notifications are emitted via Socket.IO and handled by the client notification system.
- Attachments are stored in the `uploads/leaves` directory and returned as a URL.
