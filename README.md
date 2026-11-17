# SetSpace API

RESTful backend service for **SetSpace** — the peer-to-peer marketplace for booking creative production spaces, soundstages, photo cycs, and podcast lounges. Built with Express 5, MongoDB Atlas, and stateless asymmetric JWT authentication via Ed25519 JWKS.

---

## Deployment & Links

- **Live Base URL**: [`https://setspace-api-v1.vercel.app`](https://setspace-api-v1.vercel.app)
- **Client Application**: [`https://setspace-studios.vercel.app`](https://setspace-studios.vercel.app)
- **Repository**: [`github.com/Aminul-Islam7/setspace-api`](https://github.com/Aminul-Islam7/setspace-api)

---

## Architecture & Authentication

- **Runtime & Framework**: Node.js (ES Modules), Express v5.
- **Database**: MongoDB Atlas (`setspace_prod` database with `studios`, `bookings`, `user`, and `account` collections).
- **Authorization Flow**:
  - Stateless Bearer token verification using [`jose`](https://github.com/panva/jose).
  - Fetches public JSON Web Key Sets (JWKS) from the Better Auth client endpoint (`/api/auth/jwks`).
  - Verifies Ed25519 (`EdDSA`) signatures without sharing symmetric database secrets with the backend.
  - Role-based resource guards ensure only workspace owners can edit/delete listings and only authorized bookers/hosts can transition reservation states.

---

## API Reference

### 1. Studios (`/api/studios`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/studios` | Public | List & search studios. Supports `category`, `search`, `sort`, `minPrice`, `maxPrice`, `top`, `page`, `limit`. |
| `GET` | `/api/studios/:id` | Public | Fetch single studio by MongoDB `_id` or unique `slug`. |
| `POST` | `/api/studios` | Protected | Create new studio listing. Associates authenticated user as owner. |
| `PATCH` | `/api/studios/:id` | Protected (Owner) | Update studio specs, pricing, amenities, and photo galleries. |
| `DELETE` | `/api/studios/:id` | Protected (Owner) | Permanently delete studio listing. |
| `POST` | `/api/studios/:id/reviews` | Protected (Booker) | Submit verified 1–5 star review. Restricted to creators with `Completed` bookings; strictly one review per user. |

### 2. Bookings & Availability (`/api/bookings`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/bookings/availability` | Public | Query booked time slots for a given `studioId` and `date` to prevent reservation collisions. |
| `POST` | `/api/bookings` | Protected | Create new shoot reservation with automated time-slot collision validation. |
| `GET` | `/api/bookings/:id` | Protected (Owner/Booker) | Fetch reservation details and itemized pricing breakdown. |
| `PATCH` | `/api/bookings/:id` | Protected (Owner/Booker) | Transition status: Hosts can `Confirm`, `Decline`, or `Complete`; creators can `Cancel`. |

### 3. User Resource Endpoints (`/api/users/me`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/users/me/studios` | Protected | Fetch all studio listings owned by authenticated host (`ownerEmail` match). |
| `GET` | `/api/users/me/bookings` | Protected | Fetch reservations. Returns creator bookings or host requests via `?role=host`. |

---

## Local Setup

### Prerequisites

- Node.js 18+
- npm (or pnpm / yarn)
- MongoDB Atlas URI or local MongoDB instance

### 1. Clone & Install

```bash
git clone https://github.com/Aminul-Islam7/setspace-api.git
cd setspace-api
npm install
```

### 2. Environment Variables (`.env`)

Create a `.env` file in the root directory:

```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/
CLIENT_URL=http://localhost:3000
```

> [!IMPORTANT]
> When deploying to production (e.g., Vercel), set `CLIENT_URL` to your production frontend URL (e.g., `https://setspace-studios.vercel.app`) without trailing slashes.

### 3. Run Development Server

```bash
# Starts API server with nodemon reload
npm run dev

# Starts production node process
npm start
```

The server listens on `http://localhost:5000`.
