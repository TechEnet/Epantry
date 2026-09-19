# EPANTRY

EPANTRY is a full-stack food intelligence and commerce platform designed to connect everyday food management with recipes, pantry intelligence, meal planning, grocery commerce, host operations, brands, and intelligent food experiences.

The platform supports three primary access areas:

- Customer — pantry, recipes, meal planning, grocery discovery, shopping, orders, household features, and personal food experiences.
- Host — commercial listings, marketplace operations, inventory, fulfillment, earnings, brand participation, and business tools.
- Super Admin — platform governance, catalog control, host management, security, observability, and administrative operations.

## Core Platform Capabilities

- Smart Pantry Management
- Recipe Discovery & Recipe Intelligence
- Meal Planning
- Grocery & Product Discovery
- Marketplace & Checkout
- Orders & Fulfillment
- Household Management
- Food Intelligence
- Universal Product / NPI workflows
- Brand Authority
- Host Operations
- Analytics & Notifications
- Hospitality Experiences
- Learning & Community
- Privacy & Security Operations
- Administrative Governance

## Technology

### Frontend
- React
- Vite
- React Router
- Modern modular feature architecture

### Backend
- Node.js
- Express
- MongoDB / Mongoose
- Modular domain-oriented API architecture

### Integrations
- Firebase
- Cloudinary
- Razorpay
- Product data providers
- AI integrations

## Architecture

EPANTRY follows a feature-oriented architecture with clear separation between Customer, Host, and Super Admin experiences.

frontend/
  src/
    features/
    components/
    routes/
    api/

backend/
  src/
    modules/
    integrations/
    middlewares/
    config/

Each major domain is maintained as an independent module while sharing common authentication, authorization, security, and platform infrastructure.

## Local Development

1. Install dependencies from the repository root:

   npm install

2. Configure frontend environment variables:

   frontend/.env

3. Configure backend environment variables:

   backend/.env

4. Start frontend and backend together:

   npm run dev

## Local URLs

Frontend:
http://localhost:5173

Backend:
http://localhost:5001

Health:
http://localhost:5001/api/v1/health

Ready:
http://localhost:5001/api/v1/ready

## Common Commands

npm run dev
Run the frontend and backend development servers.

npm run build
Create the frontend production build.

npm test
Run project validation and automated tests.

npm run check:db
Verify the configured MongoDB connection.

npm run security:self-test
Validate the repository security scanner.

npm run security:gate
Run dependency, secret, and static security gates.

## Security

EPANTRY includes repository-level security validation for:

- dependency vulnerabilities
- accidental secret exposure
- static security checks
- deployment security requirements
- staging security validation
- recovery and restore verification

Real credentials, private keys, .env files, node_modules, and generated build output must never be committed to the repository.

## Project Status

EPANTRY is under active development.

The current codebase includes Customer, Host, and Super Admin experiences together with marketplace, food intelligence, planning, commerce, governance, privacy, reliability, and platform expansion modules.
