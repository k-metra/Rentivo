# Rentivo Architecture

## Product boundary

Rentivo contains independently implemented rental-management foundations:

- Organizations and memberships
- Users and role-based access
- Vehicles and fleet records
- Customers
- Rentals/bookings
- Payments

CL CarHub source code, Git history, credentials, environment files, and private assets are not dependencies or inputs of this repository.

## Tenant model

The baseline schema uses organization membership and organization foreign keys. Tenant isolation must be enforced in middleware, policies, authorization services, and every domain query.

## Stack

- Backend: Laravel 13, Sanctum
- Frontend: React 19, TypeScript, Vite
- Styling: Tailwind CSS v4
- Database: environment-configurable Laravel database, SQLite locally
