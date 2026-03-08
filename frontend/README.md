# School Management Frontend

React + Vite frontend for the School Management System with JWT-based authentication.

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm (comes with Node.js)
- The backend server running on `http://localhost:8000`

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd <repository-folder>/frontend
```

### 2. Install dependencies

```bash
npm install
```

> This step is required every time you clone the project. It downloads all packages into `node_modules/`.

### 3. Start the development server

```bash
npm run dev
```

The app will be available at **http://localhost:3000**

## Important: Backend Required

This frontend proxies API requests to the Django backend at `http://localhost:8000`. Make sure the backend is running before using the app, otherwise login/register will fail.

To start the backend (from the project root):

```bash
cd backend
pip install -r requirements.txt   # first time only
python manage.py migrate          # first time only
python manage.py runserver
```

## Available Scripts

| Command | Description |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Start dev server at http://localhost:3000 |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build locally |

## Project Structure

```
frontend/
├── src/
│   ├── api/
│   │   └── auth.js          # Axios API calls (login, register, logout)
│   ├── context/
│   │   └── AuthContext.jsx  # Global auth state (user, login, logout)
│   ├── pages/
│   │   ├── Login.jsx        # Login page
│   │   ├── Register.jsx     # Register page
│   │   └── Home.jsx         # Protected home page
│   ├── App.jsx              # Routes and route guards
│   └── main.jsx             # App entry point
├── vite.config.js           # Vite config + API proxy
└── package.json
```

## How Authentication Works

- On login, JWT tokens (`access` and `refresh`) are stored in `localStorage`
- Every API request automatically includes the `Bearer` token via an Axios interceptor
- Protected routes redirect to `/login` if no valid session exists
- On logout, tokens are cleared and the refresh token is blacklisted on the backend

## Common Issues

**`vite` is not recognized** — You forgot to run `npm install`. Run it first.

**Login fails / API errors** — The backend is not running. Start it at `http://localhost:8000`.

**Port 3000 already in use** — Stop the other process or change the port in `vite.config.js`.
