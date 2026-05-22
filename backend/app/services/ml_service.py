import os
import pickle
import math
from app.db import get_db_connection

# Resolve paths for the trained models
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RF_MODEL_PATH = os.path.join(BASE_DIR, "ml", "trained_models", "random_forest.pkl")
LR_MODEL_PATH = os.path.join(BASE_DIR, "ml", "trained_models", "linear_reg.pkl")

# Cached model holders
_rf_model = None
_lr_model = None

def load_models():
    """Loads the trained pickle models from disk."""
    global _rf_model, _lr_model
    if _rf_model is None:
        print(f"Loading Random Forest Classifier from: {RF_MODEL_PATH}")
        with open(RF_MODEL_PATH, "rb") as f:
            _rf_model = pickle.load(f)
    if _lr_model is None:
        print(f"Loading Linear Regression Model from: {LR_MODEL_PATH}")
        with open(LR_MODEL_PATH, "rb") as f:
            _lr_model = pickle.load(f)
    return _rf_model, _lr_model

def run_predictions(simulated_rainfall_data=None):
    """
    Evaluates flood risk and depth for all grid cells based on current conditions.
    Accepts an optional dict to simulate custom rainfall values for districts:
    {
      "Colombo": {"daily": 120.0, "cumulative": 180.0, "trend": 15.0},
      ...
    }
    """
    rf, lr = load_models()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Fetch all grid cells along with their nearest gauging station's water level
    cursor.execute("""
        SELECT gc.id, gc.district, gc.latitude, gc.longitude, gc.elevation, gc.slope, 
               gc.distance_to_river, gs.current_level, gs.station_name
        FROM grid_cells gc
        LEFT JOIN gauging_stations gs ON gc.nearest_station_id = gs.id
    """)
    grids = cursor.fetchall()
    
    predictions_to_insert = []
    response_data = []
    
    risk_names = {0: "Low", 1: "Medium", 2: "High", 3: "Critical"}
    
    for row in grids:
        grid_id, district, lat, lon, elevation, slope, dist_to_river, station_level, station_name = row
        
        # Setup rainfall features
        # Default to a baseline, or apply simulated values if admin is testing scenarios
        daily_rainfall = 15.0
        three_day_cum = 45.0
        weekly_trend = 2.0
        
        if simulated_rainfall_data and district in simulated_rainfall_data:
            sim = simulated_rainfall_data[district]
            daily_rainfall = sim.get("daily", daily_rainfall)
            three_day_cum = sim.get("cumulative", three_day_cum)
            weekly_trend = sim.get("trend", weekly_trend)
        else:
            # Generate slightly realistic background seasonal rainfall based on river level
            # If the gauging station is flooded, we assume there has been significant rain!
            if station_level and station_level > 5.0:
                daily_rainfall = min(120.0, 10.0 * station_level)
                three_day_cum = min(220.0, 25.0 * station_level)
                weekly_trend = min(40.0, 4.0 * station_level)
            else:
                # Add some standard variance
                daily_rainfall = max(0.0, 10.0 + math.sin(grid_id) * 8.0)
                three_day_cum = max(0.0, 30.0 + math.sin(grid_id + 1) * 15.0)
                weekly_trend = math.sin(grid_id + 2) * 4.0
        
        # Adjust features based on nearest gauging station level
        # If the nearest river is high, it acts as a strong multiplier on spatial risk
        adjusted_dist_to_river = dist_to_river
        if station_level and station_level > 2.0:
            # Effectively brings the river "closer" due to overflow
            adjusted_dist_to_river = max(0.05, dist_to_river - (station_level * 0.15))
            
        # Formulate feature vector
        # [daily_rainfall, three_day_cumulative, weekly_trend, elevation, slope, dist_to_river]
        feature_vector = [
            daily_rainfall, 
            three_day_cum, 
            weekly_trend, 
            elevation, 
            slope, 
            adjusted_dist_to_river
        ]
        
        # Predict class probabilities
        probs = rf.predict_row_prob(feature_vector)
        pred_class = max(probs, key=probs.get)
        pred_risk_level = risk_names[pred_class]
        pred_prob = probs[pred_class]
        
        # Predict flood depth (Linear Regression)
        pred_depth = lr.predict([feature_vector])[0]
        # Cap depth based on predicted risk level for physical consistency
        if pred_class == 0: # Low risk
            pred_depth = 0.0
        elif pred_class == 1: # Medium risk
            pred_depth = min(0.3, pred_depth)
        elif pred_class == 2: # High risk
            pred_depth = max(0.2, min(1.2, pred_depth))
        elif pred_class == 3: # Critical
            pred_depth = max(1.0, pred_depth)
            
        predictions_to_insert.append((
            grid_id, daily_rainfall, three_day_cum, weekly_trend,
            pred_risk_level, pred_prob, pred_depth
        ))
        
        response_data.append({
            "grid_id": grid_id,
            "district": district,
            "latitude": lat,
            "longitude": lon,
            "elevation": elevation,
            "slope": slope,
            "distance_to_river": dist_to_river,
            "station_name": station_name,
            "station_level": station_level,
            "daily_rainfall": daily_rainfall,
            "cumulative_rainfall": three_day_cum,
            "weekly_trend": weekly_trend,
            "predicted_risk": pred_risk_level,
            "predicted_prob": pred_prob,
            "predicted_depth": round(pred_depth, 2)
        })
        
    # Write to database (Keep history by inserting new prediction logs)
    print(f"Saving {len(predictions_to_insert)} grid cell predictions to database...")
    for p in predictions_to_insert:
        try:
            cursor.execute("""
                INSERT INTO grid_predictions (grid_id, daily_rainfall, three_day_cumulative, weekly_trend, predicted_risk_level, predicted_risk_prob, estimated_depth)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, p)
        except Exception as e:
            print(f"Error saving prediction for grid {p[0]}: {e}")
            
    conn.commit()
    cursor.close()
    conn.close()
    
    print("Spatial prediction run completed successfully!")
    return response_data

if __name__ == "__main__":
    load_models()
    run_predictions()
