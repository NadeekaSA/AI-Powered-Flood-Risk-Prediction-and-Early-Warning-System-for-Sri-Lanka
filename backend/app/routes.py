import os
import datetime
import hashlib
import jwt
from flask import Blueprint, request, jsonify, make_response
from app.db import get_db_connection, get_station_district
from app.services.ml_service import run_predictions
from app.services.dmc_scraper import scrape_dmc_data
from app.services.push_service import broadcast_flood_alert

api = Blueprint("api", __name__)

JWT_SECRET = os.getenv("JWT_SECRET", "supersecretfloodpredictionkey123!")

# Helper functions for Password Hashing
def hash_password(password, salt=None):
    """Hashes a password securely using PBKDF2 with HMAC-SHA256 (Pure Python)."""
    if salt is None:
        salt = os.urandom(16)
    else:
        salt = bytes.fromhex(salt)
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    return key.hex(), salt.hex()

def verify_password(stored_hash, stored_salt, password):
    """Verifies a password against the stored secure PBKDF2 hash."""
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), bytes.fromhex(stored_salt), 100000)
    return key.hex() == stored_hash

# Helper functions for JWT Authentication
def token_required(f):
    """Decorator to require a valid JWT token on a route."""
    def decorator(*args, **kwargs):
        token = None
        if "Authorization" in request.headers:
            auth_header = request.headers["Authorization"]
            if auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
                
        if not token:
            return jsonify({"message": "Access token is missing!"}), 401
            
        try:
            data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            request.user_id = data["user_id"]
            request.user_role = data["role"]
        except Exception:
            return jsonify({"message": "Access token is invalid or expired!"}), 401
            
        return f(*args, **kwargs)
    decorator.__name__ = f.__name__
    return decorator

def admin_required(f):
    """Decorator to require a valid JWT token with 'admin' role."""
    def decorator(*args, **kwargs):
        token = None
        if "Authorization" in request.headers:
            auth_header = request.headers["Authorization"]
            if auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
                
        if not token:
            return jsonify({"message": "Access token is missing!"}), 401
            
        try:
            data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            if data.get("role") != "admin":
                return jsonify({"message": "Administrator privileges required!"}), 403
            request.user_id = data["user_id"]
            request.user_role = data["role"]
        except Exception:
            return jsonify({"message": "Access token is invalid or expired!"}), 401
            
        return f(*args, **kwargs)
    decorator.__name__ = f.__name__
    return decorator

# --- 1. AUTHENTICATION ENDPOINTS ---

@api.route("/auth/register", methods=["POST"])
def register():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")
    role = data.get("role", "public") # defaults to public, can be admin
    
    district = data.get("district")
    nearest_station_id = data.get("nearest_station_id")
    
    if role not in ["public", "admin"]:
        role = "public"
        
    if not username or not password:
        return jsonify({"message": "Username and password are required!"}), 400
        
    pwd_hash, salt = hash_password(password)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Check if user exists
        cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
        if cursor.fetchone():
            return jsonify({"message": "Username is already registered!"}), 409
            
        # Store user (combine hash and salt using a colon in password_hash field)
        stored_hash = f"{pwd_hash}:{salt}"
        cursor.execute("""
            INSERT INTO users (username, password_hash, role, district, nearest_station_id)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
        """, (username, stored_hash, role, district, nearest_station_id))
        user_id = cursor.fetchone()[0]
        conn.commit()
        
        return jsonify({"message": f"User registered successfully as '{role}'!", "user_id": user_id}), 201
    except Exception as e:
        print("Registration error:", e)
        conn.rollback()
        return jsonify({"message": "Internal server error occurred during registration."}), 500
    finally:
        cursor.close()
        conn.close()

@api.route("/auth/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")
    
    if not username or not password:
        return jsonify({"message": "Username and password are required!"}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT id, password_hash, role, district, nearest_station_id FROM users WHERE username = %s", (username,))
        user = cursor.fetchone()
        if not user:
            return jsonify({"message": "Invalid username or password!"}), 401
            
        user_id, stored_hash, role, district, nearest_station_id = user
        pwd_hash, salt = stored_hash.split(":")
        
        if verify_password(pwd_hash, salt, password):
            # Issue JWT
            token = jwt.encode({
                "user_id": user_id,
                "role": role,
                "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=24)
            }, JWT_SECRET, algorithm="HS256")
            
            return jsonify({
                "token": token,
                "role": role,
                "username": username,
                "id": user_id,
                "district": district,
                "nearest_station_id": nearest_station_id
            }), 200
        else:
            return jsonify({"message": "Invalid username or password!"}), 401
    except Exception as e:
        print("Login error:", e)
        return jsonify({"message": "Internal server error occurred."}), 500
    finally:
        cursor.close()
        conn.close()

# --- 2. HYDROLOGY & RIVERS ENDPOINTS ---

@api.route("/river-levels", methods=["GET"])
def get_river_levels():
    refresh = request.args.get("refresh", "false").lower() == "true"
    
    if refresh:
        # Trigger scraper to pull the latest DMC water levels
        scrape_dmc_data()
        # Trigger prediction run so all grid cells (including newly added ones) get initial predictions
        run_predictions()
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT id, station_name, river_name, basin_name, latitude, longitude, 
                   current_level, rate_of_rise, alert_status, last_updated
            FROM gauging_stations
            ORDER BY river_name, station_name
        """)
        rows = cursor.fetchall()
        
        stations = []
        for r in rows:
            stations.append({
                "id": r[0],
                "station_name": r[1],
                "river_name": r[2],
                "basin_name": r[3],
                "latitude": r[4],
                "longitude": r[5],
                "current_level": r[6],
                "rate_of_rise": r[7],
                "alert_status": r[8],
                "district": get_station_district(r[1], r[3]),
                "last_updated": r[9].isoformat() if r[9] else None
            })
            
        return jsonify(stations), 200
    except Exception as e:
        print("Fetch river levels error:", e)
        return jsonify({"message": "Failed to fetch river levels."}), 500
    finally:
        cursor.close()
        conn.close()

# --- 3. PREDICTIONS ENDPOINTS ---

@api.route("/predictions", methods=["GET"])
def get_predictions():
    """Returns the latest flood risk predictions for all spatial grid cells."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Query the latest run prediction for each grid cell
        cursor.execute("""
            SELECT DISTINCT ON (gp.grid_id) 
                   gp.grid_id, gc.district, gc.latitude, gc.longitude, gc.elevation, gc.slope, 
                   gc.distance_to_river, gs.station_name, gp.daily_rainfall, gp.three_day_cumulative, 
                   gp.weekly_trend, gp.predicted_risk_level, gp.predicted_risk_prob, gp.estimated_depth,
                   gp.run_timestamp
            FROM grid_predictions gp
            JOIN grid_cells gc ON gp.grid_id = gc.id
            LEFT JOIN gauging_stations gs ON gc.nearest_station_id = gs.id
            ORDER BY gp.grid_id, gp.run_timestamp DESC
        """)
        rows = cursor.fetchall()
        
        # If no predictions exist yet, run an initial batch
        if not rows:
            print("No predictions found. Triggering initial predictive run...")
            preds = run_predictions()
            return jsonify(preds), 200
            
        predictions = []
        for r in rows:
            predictions.append({
                "grid_id": r[0],
                "district": r[1],
                "latitude": r[2],
                "longitude": r[3],
                "elevation": r[4],
                "slope": r[5],
                "distance_to_river": r[6],
                "station_name": r[7],
                "daily_rainfall": r[8],
                "cumulative_rainfall": r[9],
                "weekly_trend": r[10],
                "predicted_risk": r[11],
                "predicted_prob": r[12],
                "predicted_depth": r[13],
                "run_timestamp": r[14].isoformat() if r[14] else None
            })
            
        return jsonify(predictions), 200
    except Exception as e:
        print("Fetch predictions error:", e)
        return jsonify({"message": "Failed to fetch flood predictions."}), 500
    finally:
        cursor.close()
        conn.close()

# --- 4. ALERTS & PUSH NOTIFICATIONS ---

@api.route("/alerts", methods=["GET"])
def get_alerts():
    """Fetches active warning notifications."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT id, title, message, risk_level, district, created_at 
            FROM alerts 
            WHERE is_active = TRUE
            ORDER BY created_at DESC
        """)
        rows = cursor.fetchall()
        
        alerts = []
        for r in rows:
            alerts.append({
                "id": r[0],
                "title": r[1],
                "message": r[2],
                "risk_level": r[3],
                "district": r[4],
                "is_active": True,
                "created_at": r[5].isoformat()
            })
            
        return jsonify(alerts), 200
    except Exception as e:
        print("Fetch alerts error:", e)
        return jsonify({"message": "Failed to fetch alerts."}), 500
    finally:
        cursor.close()
        conn.close()

@api.route("/alerts/subscribe", methods=["POST"])
def subscribe():
    """Registers a client's Web Push Subscription."""
    data = request.get_json() or {}
    endpoint = data.get("endpoint")
    keys = data.get("keys", {})
    p256dh = keys.get("p256dh") or data.get("p256dh")
    auth = keys.get("auth") or data.get("auth")
    user_id = data.get("user_id") # optional, maps to registered user
    
    # Securely extract user_id from JWT token if available in Authorization headers
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            decoded = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            token_user_id = decoded.get("user_id")
            if token_user_id:
                user_id = token_user_id
        except Exception as jwt_err:
            print("JWT token decoding failed during subscription:", jwt_err)
    
    if not endpoint or not p256dh or not auth:
        return jsonify({"message": "Invalid subscription payload."}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (endpoint) DO UPDATE 
            SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, user_id = EXCLUDED.user_id
        """, (user_id, endpoint, p256dh, auth))
        conn.commit()
        return jsonify({"message": "Successfully subscribed to early warning notifications!"}), 201
    except Exception as e:
        print("Subscribe error:", e)
        conn.rollback()
        return jsonify({"message": "Subscription registration failed."}), 500
    finally:
        cursor.close()
        conn.close()

# --- 5. ADMIN CONTROL & SIMULATION ---

@api.route("/admin/alerts", methods=["POST"])
@admin_required
def create_alert():
    """Allows administrators to manually broadcast a warning alert."""
    data = request.get_json()
    title = data.get("title")
    message = data.get("message")
    risk_level = data.get("risk_level", "Medium")
    district = data.get("district")
    
    if not title or not message:
        return jsonify({"message": "Alert title and message are required!"}), 400
        
    alert_id = broadcast_flood_alert(title, message, risk_level, district)
    if alert_id:
        return jsonify({"message": "Alert logged and broadcast successfully!", "alert_id": alert_id}), 201
    else:
        return jsonify({"message": "Failed to create or broadcast alert."}), 500

@api.route("/admin/simulate", methods=["POST"])
@admin_required
def simulate_rainfall():
    """
    Simulates custom rainfall amounts across specific districts.
    Triggers the Random Forest and Linear Regression models to evaluate spatial risks.
    Request body:
    {
      "district_rain": {
         "Colombo": {"daily": 140.0, "cumulative": 210.0, "trend": 18.0},
         "Ratnapura": {"daily": 160.0, "cumulative": 280.0, "trend": 24.0}
      }
    }
    """
    data = request.get_json()
    district_rain = data.get("district_rain", {})
    
    try:
        # Re-run ML predictions with custom simulated values
        updated_preds = run_predictions(district_rain)
        
        # Proactively check if any simulated grid cell turned 'Critical'
        critical_count = sum(1 for p in updated_preds if p["predicted_risk"] == "Critical")
        if critical_count > 0:
            # Dynamically broadcast a system early warning for those districts!
            districts_at_risk = list(set(p["district"] for p in updated_preds if p["predicted_risk"] == "Critical"))
            d_str = ", ".join(districts_at_risk)
            broadcast_flood_alert(
                title=f"🚨 CRITICAL Flood Early Warning: {d_str}",
                message=f"Simulation results indicate a Critical flood risk across {critical_count} spatial zones. Immediate preparedness and evacuation are advised.",
                risk_level="Critical",
                district=districts_at_risk[0] if districts_at_risk else None
            )
            
        return jsonify({
            "message": "Rainfall simulation completed and ML engine re-scored successfully!",
            "critical_cells": critical_count,
            "predictions": updated_preds
        }), 200
    except Exception as e:
        print("Rainfall simulation error:", e)
        return jsonify({"message": "Failed to process simulation."}), 500

# --- 6. REPORTING ENDPOINT ---

@api.route("/reports", methods=["GET"])
def download_report():
    """Generates a downloadable CSV report of current flood predictions across Sri Lanka."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT DISTINCT ON (gp.grid_id) 
                   gp.grid_id, gc.district, gc.latitude, gc.longitude, gc.elevation, gc.slope, 
                   gc.distance_to_river, gs.station_name, gp.daily_rainfall, gp.three_day_cumulative, 
                   gp.predicted_risk_level, gp.predicted_risk_prob, gp.estimated_depth, gp.run_timestamp
            FROM grid_predictions gp
            JOIN grid_cells gc ON gp.grid_id = gc.id
            LEFT JOIN gauging_stations gs ON gc.nearest_station_id = gs.id
            ORDER BY gp.grid_id, gp.run_timestamp DESC
        """)
        rows = cursor.fetchall()
        
        # Create CSV text
        csv_content = "Grid ID,District,Latitude,Longitude,Elevation (m),Slope (deg),Dist to River (km),Nearest Gauge,Daily Rainfall (mm),3-Day Cumulative (mm),Predicted Risk,Probability,Est Depth (m),Scoring Time\n"
        
        for r in rows:
            station_name = r[7] if r[7] else "None"
            run_time = r[13].strftime("%Y-%m-%d %H:%M:%S") if r[13] else "None"
            csv_content += f"{r[0]},{r[1]},{r[2]:.4f},{r[3]:.4f},{r[4]:.2f},{r[5]:.2f},{r[6]:.2f},{station_name},{r[8]:.1f},{r[9]:.1f},{r[10]},{r[11]:.4f},{r[12]:.2f},{run_time}\n"
            
        response = make_response(csv_content)
        response.headers["Content-Disposition"] = "attachment; filename=srilanka_flood_risk_report.csv"
        response.headers["Content-type"] = "text/csv"
        return response
    except Exception as e:
        print("CSV Report error:", e)
        return jsonify({"message": "Failed to generate report."}), 500
    finally:
        cursor.close()
        conn.close()
