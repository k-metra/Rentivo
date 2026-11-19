# Rentivo

Rentivo is an independent, multi-tenant vehicle rental and fleet management SaaS foundation.

CL CarHub remains separate and unchanged. Rentivo has its own repository, database, authentication, environment configuration, dependencies, and application source.

## Structure

- `backend/` - Laravel 13 API and SaaS domain
- `frontend/` - React 19, TypeScript, Vite, and Tailwind CSS v4
- `docs/` - Architecture and product documentation

## Local development

Backend:

```powershell
cd backend
copy .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve --host=127.0.0.1 --port=8000
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

## Core SaaS boundary

Organization-scoped data uses `organization_id` and organization membership. Application queries must always be scoped to the authenticated user's active organization.
