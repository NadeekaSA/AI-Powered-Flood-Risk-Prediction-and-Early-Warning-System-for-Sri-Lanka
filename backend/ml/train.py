import os
import sys
import pickle
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import accuracy_score, classification_report, mean_squared_error, mean_absolute_error
import nbformat as nbf

def map_risk_level(depth):
    if depth == 0.0:
        return 0  # Low
    elif depth <= 1.0:
        return 1  # Medium
    elif depth <= 2.5:
        return 2  # High
    else:
        return 3  # Critical

def train_and_evaluate():
    # Setup paths
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dataset_path = os.path.join(base_dir, "dataset", "sri_lanka_flood_risk_dataset.csv")
    models_dir = os.path.join(base_dir, "ml", "trained_models")
    notebook_path = os.path.join(base_dir, "dataset", "flood_eda.ipynb")
    
    os.makedirs(models_dir, exist_ok=True)
    
    print(f"Loading actual dataset from: {dataset_path}...")
    df = pd.read_csv(dataset_path)
    
    # 1. Target Engineering
    df['risk_level'] = df['flood_depth_m'].apply(map_risk_level)
    
    # Define features and targets
    feature_cols = [
        'daily_rainfall_mm', 
        '3_day_cumulative_rain', 
        'rate_of_rise', 
        'elevation_m', 
        'slope_degrees', 
        'distance_to_river_km'
    ]
    X = df[feature_cols]
    y_class = df['risk_level']
    y_depth = df['flood_depth_m']
    
    # Train-Test Split (80/20)
    X_train, X_test, y_c_train, y_c_test = train_test_split(X, y_class, test_size=0.2, random_state=42, stratify=y_class)
    _, _, y_d_train, y_d_test = train_test_split(X, y_depth, test_size=0.2, random_state=42)
    
    print(f"Training set size: {X_train.shape[0]} samples")
    print(f"Testing set size: {X_test.shape[0]} samples\n")
    
    # 2. Hyperparameter Tuning for Classifier
    print("Tuning Hyperparameters for Random Forest Classifier...")
    rf_clf = RandomForestClassifier(random_state=42)
    clf_param_grid = {
        'n_estimators': [50, 100, 150],
        'max_depth': [6, 8, 10],
        'min_samples_split': [2, 5]
    }
    clf_grid = GridSearchCV(rf_clf, clf_param_grid, cv=3, scoring='accuracy', n_jobs=-1)
    clf_grid.fit(X_train, y_c_train)
    
    best_clf = clf_grid.best_estimator_
    print(f"Best Classifier Params: {clf_grid.best_params_}")
    
    y_c_pred = best_clf.predict(X_test)
    clf_acc = accuracy_score(y_c_test, y_c_pred)
    print(f"Classifier Test Accuracy: {clf_acc:.4f} ({clf_acc * 100:.2f}%)")
    print("\nClassification Report:")
    print(classification_report(y_c_test, y_c_pred, target_names=["Low", "Medium", "High", "Critical"]))
    
    # 3. Hyperparameter Tuning for Regressor
    print("Tuning Hyperparameters for Random Forest Regressor...")
    rf_reg = RandomForestRegressor(random_state=42)
    reg_param_grid = {
        'n_estimators': [50, 100, 150],
        'max_depth': [6, 8, 10],
        'min_samples_split': [2, 5]
    }
    reg_grid = GridSearchCV(rf_reg, reg_param_grid, cv=3, scoring='neg_mean_squared_error', n_jobs=-1)
    reg_grid.fit(X_train, y_d_train)
    
    best_reg = reg_grid.best_estimator_
    print(f"Best Regressor Params: {reg_grid.best_params_}")
    
    y_d_pred = best_reg.predict(X_test)
    mse = mean_squared_error(y_d_test, y_d_pred)
    rmse = np.sqrt(mse)
    mae = mean_absolute_error(y_d_test, y_d_pred)
    print(f"Regressor Test RMSE: {rmse:.4f} meters")
    print(f"Regressor Test MAE: {mae:.4f} meters\n")
    
    # Save the models
    rf_path = os.path.join(models_dir, "random_forest.pkl")
    rf_reg_path = os.path.join(models_dir, "random_forest_reg.pkl")
    
    print(f"Saving models to:\n -> {rf_path}\n -> {rf_reg_path}")
    with open(rf_path, "wb") as f:
        pickle.dump(best_clf, f)
    with open(rf_reg_path, "wb") as f:
        pickle.dump(best_reg, f)
        
    # 4. Generate Jupyter Notebook
    print(f"\nGenerating step-by-step Jupyter Notebook at {notebook_path}...")
    nb = nbf.v4.new_notebook()
    
    # Convert parameters to strings to paste in notebook code
    clf_params_str = str(clf_grid.best_params_)
    reg_params_str = str(reg_grid.best_params_)
    
    cells = [
        nbf.v4.new_markdown_cell(
            "# Sri Lanka Flood Prediction Model Training\n"
            "This notebook details the Exploratory Data Analysis (EDA) and Hyperparameter Optimization "
            "for predicting flood risk levels and estimating flood depth in Sri Lanka."
        ),
        nbf.v4.new_code_cell(
            "import pandas as pd\n"
            "import numpy as np\n"
            "import matplotlib.pyplot as plt\n"
            "import seaborn as sns\n"
            "from sklearn.model_selection import train_test_split, GridSearchCV\n"
            "from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor\n"
            "from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, mean_squared_error, mean_absolute_error\n"
            "import pickle\n"
            "import os\n\n"
            "sns.set_theme(style='whitegrid')"
        ),
        nbf.v4.new_markdown_cell("## 1. Load the Actual Dataset"),
        nbf.v4.new_code_cell(
            f"dataset_path = r'{dataset_path}'\n"
            "df = pd.read_csv(dataset_path)\n"
            "df.head()"
        ),
        nbf.v4.new_markdown_cell("## 2. Basic Dataset Info"),
        nbf.v4.new_code_cell(
            "print('Dataset Shape:', df.shape)\n"
            "df.info()\n"
            "df.describe()"
        ),
        nbf.v4.new_markdown_cell("## 3. Exploratory Data Analysis (EDA)\n"
                                 "Let's visualize target distributions, feature correlations, and hydrological relations."),
        nbf.v4.new_code_cell(
            "plt.figure(figsize=(8, 4))\n"
            "sns.countplot(data=df, x='flood_occurred', palette='Set2')\n"
            "plt.title('Distribution of Flood Events (0: No Flood, 1: Flood)')\n"
            "plt.show()"
        ),
        nbf.v4.new_markdown_cell("### Correlation Heatmap"),
        nbf.v4.new_code_cell(
            "plt.figure(figsize=(10, 8))\n"
            "numeric_df = df.select_dtypes(include=[np.number])\n"
            "sns.heatmap(numeric_df.corr(), annot=True, cmap='coolwarm', fmt='.2f')\n"
            "plt.title('Feature Correlation Matrix')\n"
            "plt.show()"
        ),
        nbf.v4.new_markdown_cell("### Hydrological Relationships: Daily Rainfall vs River Level"),
        nbf.v4.new_code_cell(
            "plt.figure(figsize=(10, 6))\n"
            "sns.scatterplot(data=df, x='daily_rainfall_mm', y='river_level_m', hue='flood_occurred', palette='Set1', alpha=0.7)\n"
            "plt.title('Rainfall vs River Level by Flood Occurrence')\n"
            "plt.show()"
        ),
        nbf.v4.new_markdown_cell("## 4. Feature Mapping & Target Engineering"),
        nbf.v4.new_code_cell(
            "def map_risk_level(depth):\n"
            "    if depth == 0.0:\n"
            "        return 0\n"
            "    elif depth <= 1.0:\n"
            "        return 1\n"
            "    elif depth <= 2.5:\n"
            "        return 2\n"
            "    else:\n"
            "        return 3\n\n"
            "df['risk_level'] = df['flood_depth_m'].apply(map_risk_level)\n\n"
            "plt.figure(figsize=(8, 4))\n"
            "sns.countplot(data=df, x='risk_level', palette='viridis')\n"
            "plt.title('Engineered Risk Level Distribution (0:Low, 1:Med, 2:High, 3:Crit)')\n"
            "plt.show()"
        ),
        nbf.v4.new_markdown_cell("## 5. Model Training & Hyperparameter Tuning"),
        nbf.v4.new_code_cell(
            "feature_cols = ['daily_rainfall_mm', '3_day_cumulative_rain', 'rate_of_rise', 'elevation_m', 'slope_degrees', 'distance_to_river_km']\n"
            "X = df[feature_cols]\n"
            "y_class = df['risk_level']\n"
            "y_depth = df['flood_depth_m']\n\n"
            "X_train, X_test, y_c_train, y_c_test = train_test_split(X, y_class, test_size=0.2, random_state=42, stratify=y_class)\n"
            "_, _, y_d_train, y_d_test = train_test_split(X, y_depth, test_size=0.2, random_state=42)"
        ),
        nbf.v4.new_markdown_cell("### Train and Optimize Random Forest Classifier"),
        nbf.v4.new_code_cell(
            "# Define grid search parameter space\n"
            "rf_clf = RandomForestClassifier(random_state=42)\n"
            "clf_param_grid = {\n"
            "    'n_estimators': [50, 100, 150],\n"
            "    'max_depth': [6, 8, 10],\n"
            "    'min_samples_split': [2, 5]\n"
            "}\n"
            "clf_grid = GridSearchCV(rf_clf, clf_param_grid, cv=3, scoring='accuracy', n_jobs=-1)\n"
            "clf_grid.fit(X_train, y_c_train)\n"
            "best_clf = clf_grid.best_estimator_\n"
            f"print('Best Classifier parameters found:', clf_grid.best_params_)"
        ),
        nbf.v4.new_markdown_cell("### Evaluate Classifier"),
        nbf.v4.new_code_cell(
            "y_c_pred = best_clf.predict(X_test)\n"
            "print('Test Accuracy:', accuracy_score(y_c_test, y_c_pred))\n"
            "print(classification_report(y_c_test, y_c_pred, target_names=['Low', 'Medium', 'High', 'Critical']))\n\n"
            "# Confusion Matrix Heatmap\n"
            "cm = confusion_matrix(y_c_test, y_c_pred)\n"
            "plt.figure(figsize=(6, 5))\n"
            "sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', xticklabels=['Low', 'Med', 'High', 'Crit'], yticklabels=['Low', 'Med', 'High', 'Crit'])\n"
            "plt.title('Classification Confusion Matrix')\n"
            "plt.ylabel('Actual')\n"
            "plt.xlabel('Predicted')\n"
            "plt.show()"
        ),
        nbf.v4.new_markdown_cell("### Train and Optimize Random Forest Regressor"),
        nbf.v4.new_code_cell(
            "rf_reg = RandomForestRegressor(random_state=42)\n"
            "reg_param_grid = {\n"
            "    'n_estimators': [50, 100, 150],\n"
            "    'max_depth': [6, 8, 10],\n"
            "    'min_samples_split': [2, 5]\n"
            "}\n"
            "reg_grid = GridSearchCV(rf_reg, reg_param_grid, cv=3, scoring='neg_mean_squared_error', n_jobs=-1)\n"
            "reg_grid.fit(X_train, y_d_train)\n"
            "best_reg = reg_grid.best_estimator_\n"
            f"print('Best Regressor parameters found:', reg_grid.best_params_)"
        ),
        nbf.v4.new_markdown_cell("### Evaluate Regressor"),
        nbf.v4.new_code_cell(
            "y_d_pred = best_reg.predict(X_test)\n"
            "mse = mean_squared_error(y_d_test, y_d_pred)\n"
            "rmse = np.sqrt(mse)\n"
            "mae = mean_absolute_error(y_d_test, y_d_pred)\n"
            "print(f'Test MSE: {mse:.4f}')\n"
            "print(f'Test RMSE: {rmse:.4f} meters')\n"
            "print(f'Test MAE: {mae:.4f} meters')"
        )
    ]
    
    nb['cells'] = cells
    with open(notebook_path, "w") as f:
        nbf.write(nb, f)
    print("Jupyter Notebook generated successfully!")

if __name__ == "__main__":
    train_and_evaluate()
