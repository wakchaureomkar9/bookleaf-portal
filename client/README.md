# BookLeaf Author Support Portal - Client

Frontend client for the BookLeaf Author Support Portal built with Vite, React, React Router, and plain CSS.

## Setup

1. Navigate to the `client` directory:
   ```bash
   cd client
   ```

2. Copy the environment variables template:
   ```bash
   cp .env.example .env
   ```

3. Configure your API base URL in `.env`:
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```
   If omitted, `VITE_API_URL` defaults to `http://localhost:5000/api`.

4. Install dependencies:
   ```bash
   npm install
   ```

## Run Commands

- **Development server**:
  ```bash
  npm run dev
  ```
  Starts Vite dev server at `http://localhost:5173`.

- **Production build**:
  ```bash
  npm run build
  ```
  Builds the application into the `dist/` directory.

- **Preview build**:
  ```bash
  npm run preview
  ```
  Previews the production build locally.

## Demo Logins

Make sure the backend server (`/server`) is running on port 5000 and seeded with the database. Passwords correspond to those configured in `server/.env`:

- **Admin Account**:
  - Email: `admin@bookleaf.com`
  - Password: `Admin@123` *(noted as `ADMIN_PASSWORD` in `server/.env`)*

- **Author Account**:
  - Email: `priya.sharma@email.com`
  - Password: `Author@123` *(noted as `SEED_AUTHOR_PASSWORD` in `server/.env`)*
