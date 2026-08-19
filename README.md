# AI-Powered Flood Risk Prediction and Early Warning System for Sri Lanka

## 🌊 Overview
The **AI-Powered Flood Risk Prediction and Early Warning System** is a comprehensive full-stack application designed to predict flood risks across various river stations in Sri Lanka. It leverages machine learning models to forecast river water levels, scrapes real-time data from the Disaster Management Centre (DMC), and issues early warning push notifications to users based on their location and nearest monitoring stations.

## ✨ Key Features
- **Real-Time Data Integration:** Scrapes live river level data from the Sri Lanka DMC website to keep the system updated.
- **AI/ML Flood Prediction:** Utilizes trained Machine Learning models including a **Random Forest Regressor** (to predict numeric flood depth) and a **Random Forest Classifier** (to predict discrete flood risk levels: Low, Medium, High, Critical) based on historical and real-time data.
- **Interactive Mapping:** Features a React-Leaflet based interactive map showing river stations, current water levels, and status indicators (Normal, Alert, Minor Flood, Major Flood).
- **Push Notifications:** Implements Web Push (VAPID) to send instant alerts to subscribed users when their nearby stations exceed safety thresholds.
- **User Authentication & Authorization:** Secure JWT-based authentication with distinct roles (Public users and Administrators).
- **Data Visualization:** Provides historical charts and trend analysis using Recharts.
- **Admin Dashboard:** Allows administrators to trigger manual data refreshes, run ML predictions, and broadcast alerts.

## 🏗️ System Architecture
The project is divided into two main components:
1. **Backend:** A Python Flask REST API connected to a PostgreSQL database, handling data scraping, ML inference, user management, and push notification dispatch.
2. **Frontend:** A React.js Single Page Application (SPA) built with Vite, providing an interactive and responsive user interface.

## 🛠️ Technology Stack

### Backend
- **Framework:** Flask (Python)
- **Database:** PostgreSQL (pg8000 driver)
- **Authentication:** PyJWT (JSON Web Tokens)
- **Machine Learning:** Scikit-learn, Pandas, Joblib (Model serialization)
- **Push Notifications:** pywebpush
- **Web Scraping:** BeautifulSoup / Requests
- **Server:** Gunicorn (for production)

### Frontend
- **Framework:** React 19 (via Vite)
- **Routing:** React Router DOM
- **Maps:** Leaflet & React-Leaflet
- **Charts:** Recharts
- **HTTP Client:** Axios
- **Styling:** Vanilla CSS / Tailwind (if configured)

## 📂 Directory Structure

```text
flood_predict/
├── backend/
│   ├── app/
│   │   ├── __init__.py        # Flask app factory
│   │   ├── routes.py          # API endpoints (Auth, River Levels, Alerts, Push)
│   │   ├── db.py              # PostgreSQL database connection and queries
│   │   └── services/
│   │       ├── ml_service.py  # Machine learning prediction logic
│   │       ├── dmc_scraper.py # DMC website scraping logic
│   │       └── push_service.py# VAPID Push notification logic
│   ├── dataset/
│   │   └── flood_eda.ipynb    # Jupyter notebook for Exploratory Data Analysis
│   ├── ml/
│   │   └── models/            # Serialized ML models (e.g., Random Forest .pkl files)
│   ├── run.py                 # Backend entry point
│   ├── requirements.txt       # Python dependencies
│   ├── get_vapid_keys.py      # Utility to generate VAPID keys
│   └── .env                   # Backend environment variables
│
└── frontend/
    ├── src/
    │   ├── components/        # Reusable UI components (Map, Charts, Modals)
    │   ├── pages/             # Page views (Dashboard, Login, Admin)
    │   ├── App.jsx            # Main React component
    │   └── main.jsx           # React entry point
    ├── public/                # Static assets (images, service worker for push)
    ├── package.json           # Node dependencies and scripts
    ├── vite.config.js         # Vite configuration
    └── .env                   # Frontend environment variables
```

## 🚀 Setup & Installation

### Prerequisites
- Node.js (v18+)
- Python (v3.9+)
- PostgreSQL (v12+)

### 1. Database Setup
1. Create a PostgreSQL database (e.g., `flood_db`).
2. Ensure you have the credentials (User, Password, Host, Port, Database Name) ready.

### 2. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # On Windows
   venv\Scripts\activate
   # On Mac/Linux
   source venv/bin/activate
   ```
3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file in the `backend` directory with the following variables:
   ```env
   DB_USER=your_db_user
   DB_PASS=your_db_password
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=flood_db
   JWT_SECRET=your_super_secret_key
   VAPID_PRIVATE_KEY=your_vapid_private_key
   VAPID_PUBLIC_KEY=your_vapid_public_key
   VAPID_CLAIMS_EMAIL=mailto:admin@example.com
   ```
   *(Note: You can generate VAPID keys by running `python get_vapid_keys.py`)*
5. Run the backend server:
   ```bash
   python run.py
   ```
   The backend will run on `http://localhost:5000`.

### 3. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `frontend` directory:
   ```env
   VITE_API_BASE_URL=http://localhost:5000/api
   VITE_VAPID_PUBLIC_KEY=your_vapid_public_key_here
   ```
4. Start the Vite development server:
   ```bash
   npm run dev
   ```
   The frontend will run on `http://localhost:5173`.

## 📡 API Endpoints Summary

### Authentication
- `POST /api/auth/register` - Register a new user.
- `POST /api/auth/login` - Authenticate and receive a JWT.

### River Levels & Data
- `GET /api/river-levels?refresh=true/false` - Fetch current river levels (optionally scrape DMC for fresh data).
- `GET /api/river-levels/<station_id>/history` - Fetch historical data for a specific station.

### Predictions & Alerts
- `GET /api/predictions` - Run ML models to generate predictions.
- `GET /api/alerts` - Fetch current active flood alerts.
- `POST /api/alerts/broadcast` - (Admin) Broadcast push notifications to subscribed users.

### Push Notifications
- `POST /api/push/subscribe` - Subscribe a user's browser to push notifications.

## 🤖 Machine Learning Pipeline
The ML pipeline is centered around predicting future river levels based on historical gauge readings and rainfall data.
- **EDA:** The `dataset/flood_eda.ipynb` contains the exploratory data analysis, feature engineering, and model training processes.
- **Models:** The system uses two types of models based on Random Forests: a **Classifier** for predicting discrete flood risk levels, and a **Regressor** for predicting numerical flood depth. These are serialized as `.pkl` files and loaded into memory by the Flask backend for real-time inference when the `/api/predictions` endpoint is called.

## 🛡️ License & Disclaimer
This project is intended for educational and early-warning research purposes. While it strives for accuracy, it should **not** replace official disaster management announcements from the Sri Lanka Disaster Management Centre.
