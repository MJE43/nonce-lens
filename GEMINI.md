# Project Overview

This is a full-stack web application for analyzing "nonce" data from a betting game. The project is divided into a frontend and a backend.

**Frontend:**
- A React application built with Vite.
- Uses Mantine for UI components and React Router for navigation.
- Interacts with the backend API to display data.
- Pages include "Runs" for analyzing historical data and "Live Streams" for real-time data.

**Backend:**
- A Python FastAPI application.
- Uses SQLModel for database interaction with a SQLite database.
- Provides a REST API for the frontend to consume.
- Endpoints for creating and retrieving "runs" of nonce analysis.
- Endpoints for ingesting and analyzing real-time "live stream" betting data.

# Building and Running

**Frontend:**
1. Navigate to the `frontend` directory.
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`

**Backend:**
1. Navigate to the `backend` directory.
2. Create a virtual environment: `python -m venv .venv`
3. Activate the virtual environment:
   - Windows: `.venv\Scripts\activate`
   - macOS/Linux: `source .venv/bin/activate`
4. Install dependencies: `pip install -r requirements.txt`
5. Start the server: `uvicorn app.main:app --reload`

# Development Conventions

- The backend code follows a standard FastAPI project structure with routers, models, and schemas.
- The frontend code is organized into pages, components, and styles.
- The project uses `.gitignore` to exclude common development files and directories.
