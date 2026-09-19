# EPANTRY

MERN-based food intelligence and commerce platform.

## Current implementation status

- M00 - project foundation: complete
- M01 - landing page: complete
- Grocery, Brands, Recipes and Search have dedicated real module routes ready for their implementation phases.
- The old frontend prototype implementation has been removed from active project code.

## Local setup

1. Copy `frontend/.env.example` to `frontend/.env`.
2. Copy `backend/.env.example` to `backend/.env`.
3. Put the real MongoDB Atlas URI in `backend/.env`.
4. Run `npm install` from the repository root.
5. Run `npm run dev` from the repository root.

## Local URLs

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5001`
- Health: `http://localhost:5001/api/v1/health`
- Ready: `http://localhost:5001/api/v1/ready`
- Bootstrap: `http://localhost:5001/api/v1/meta/bootstrap`
- Landing content: `http://localhost:5001/api/v1/landing/featured`
- Development debug page: `http://localhost:5173/__debug`

The debug route is only registered by Vite in development mode.

## Commands

- `npm run dev` - run frontend and backend together.
- `npm test` - run M00/M01 validation, frontend production build and backend API tests.
- `npm run check:db` - verify the configured MongoDB connection.
- `npm run seed` - load development seed data when `ALLOW_SEED=true` and the environment is not production.

## Project organization

- `frontend/src/features/landing` - completed M01 landing module.
- `frontend/src/features/grocery` - Grocery module entry point.
- `frontend/src/features/brands` - Brands module entry point.
- `frontend/src/features/recipes` - Recipes module entry point.
- `frontend/src/features/search` - Search module entry point.
- `frontend/src/features/system` - application bootstrap and development diagnostics.
- `backend/src/modules` - backend domain modules.
- `backend/seed-data` - development-only catalog fixtures used by the seed command.
- `docs` - project documentation. This directory is retained exactly as supplied.

## Important

Do not commit real `.env` files, `node_modules`, or frontend build output.
