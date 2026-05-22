import os
import sys
import random
import math
import pickle

# Ensure backend root is on Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.pure_ml import RandomForest, LinearRegression

def generate_bootstrap_data(num_samples=800):
    """Generates a synthetic historical flood dataset conforming to hydrological principles in Sri Lanka."""
    X = []
    y_class = [] # 0=Low, 1=Medium, 2=High, 3=Critical
    y_depth = [] # Depth in meters
    
    random.seed(42) # Replicable training
    
    for _ in range(num_samples):
        # 1. Rainfall Features
        daily_rain = random.uniform(0.0, 180.0) # mm
        three_day_cum = daily_rain + random.uniform(0.0, 250.0) # mm
        weekly_trend = random.uniform(-30.0, 80.0) # mm (positive means increasing)
        
        # 2. Topographical Features
        elevation = random.uniform(1.0, 80.0) # meters
        slope = random.uniform(0.1, 15.0) # degrees
        
        # 3. Hydrological Features
        dist_to_river = random.uniform(0.05, 5.0) # km
        
        # Calculate a realistic flood score
        # High rainfall + Low elevation + Flat slope + Proximity to river increases risk
        rain_score = (three_day_cum * 0.45) + (daily_rain * 0.2) + (weekly_trend * 0.08)
        topo_score = (elevation * 0.6) + (slope * 0.8) + (dist_to_river * 4.5)
        
        net_score = rain_score - topo_score
        
        # Class determination
        if net_score >= 35.0:
            risk = 3  # Critical
        elif net_score >= 12.0:
            risk = 2  # High
        elif net_score >= -8.0:
            risk = 1  # Medium
        else:
            risk = 0  # Low
            
        # Depth calculation (m)
        if risk > 0:
            depth = (three_day_cum * 0.015) + (daily_rain * 0.005) - (elevation * 0.03) - (dist_to_river * 0.15)
            depth = max(0.0, depth + random.uniform(-0.15, 0.15))
        else:
            depth = 0.0
            
        X.append([daily_rain, three_day_cum, weekly_trend, elevation, slope, dist_to_river])
        y_class.append(risk)
        y_depth.append(depth)
        
    return X, y_class, y_depth

def train_and_evaluate():
    print("Generating bootstrap training dataset...")
    X, y_class, y_depth = generate_bootstrap_data(800)
    
    # 80-20 Train-Test Split
    split = int(0.8 * len(X))
    X_train, X_test = X[:split], X[split:]
    y_c_train, y_c_test = y_class[:split], y_class[split:]
    y_d_train, y_d_test = y_depth[:split], y_depth[split:]
    
    print(f"Training set: {len(X_train)} samples, Test set: {len(X_test)} samples.")
    
    # 1. Train Random Forest Classifier
    print("Training Random Forest Classifier (15 trees)...")
    rf = RandomForest(n_estimators=15, max_depth=6)
    rf.fit(X_train, y_c_train)
    
    # Evaluate Random Forest
    rf_preds = rf.predict(X_test)
    accuracy = sum(1 for a, b in zip(y_c_test, rf_preds) if a == b) / len(y_c_test)
    print(f"Random Forest Classifier Accuracy: {accuracy:.4f} ({accuracy * 100:.2f}%)")
    
    # Print Confusion-like grid
    print("\nPredicted vs Actual Matrix (Test Set):")
    class_names = ["Low", "Medium", "High", "Critical"]
    counts = [[0]*4 for _ in range(4)]
    for act, pred in zip(y_c_test, rf_preds):
        counts[act][pred] += 1
        
    print("Actual \\ Pred  | Low | Med | High | Crit")
    print("------------------------------------------")
    for i in range(4):
        print(f"{class_names[i]:<14} | {counts[i][0]:<3} | {counts[i][1]:<3} | {counts[i][2]:<4} | {counts[i][3]:<4}")
        
    # 2. Train Linear Regression
    print("\nTraining Linear Regression for flood depth...")
    lr = LinearRegression(lr=0.01, epochs=600)
    lr.fit(X_train, y_d_train)
    
    # Evaluate Linear Regression
    lr_preds = lr.predict(X_test)
    mse = sum((a - b)**2 for a, b in zip(y_d_test, lr_preds)) / len(y_d_test)
    rmse = math.sqrt(mse)
    mae = sum(abs(a - b) for a, b in zip(y_d_test, lr_preds)) / len(y_d_test)
    print(f"Linear Regression MSE: {mse:.4f}")
    print(f"Linear Regression RMSE: {rmse:.4f} meters")
    print(f"Linear Regression MAE: {mae:.4f} meters")
    
    # Create models directory
    models_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "trained_models")
    os.makedirs(models_dir, exist_ok=True)
    
    # Save models
    rf_path = os.path.join(models_dir, "random_forest.pkl")
    lr_path = os.path.join(models_dir, "linear_reg.pkl")
    
    print(f"\nSaving models to:")
    print(f" -> {rf_path}")
    print(f" -> {lr_path}")
    
    with open(rf_path, "wb") as f:
        pickle.dump(rf, f)
        
    with open(lr_path, "wb") as f:
        pickle.dump(lr, f)
        
    print("\nModel training and saving complete!")

if __name__ == "__main__":
    train_and_evaluate()
