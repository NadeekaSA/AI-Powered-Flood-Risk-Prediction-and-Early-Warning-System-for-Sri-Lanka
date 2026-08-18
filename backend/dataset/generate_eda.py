import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import nbformat as nbf
import os
import json

# Setup paths
DATA_PATH = r"D:\flood_predict\backend\dataset\sri_lanka_flood_dataset.csv"
OUTPUT_DIR = r"C:\Users\Nadeeka Sachinthana\.gemini\antigravity\brain\404d21e3-70af-458f-9147-138ad8f58867"
NOTEBOOK_PATH = r"D:\flood_predict\backend\dataset\flood_eda.ipynb"

# Ensure output directory exists
os.makedirs(os.path.join(OUTPUT_DIR, "scratch"), exist_ok=True)

print("Loading dataset...")
df = pd.read_csv(DATA_PATH)

# ==========================================
# 1. GENERATE PLOTS FOR THE MARKDOWN REPORT
# ==========================================
print("Generating plots...")
sns.set_theme(style="whitegrid")

# Plot 1: Target Variable Distribution
plt.figure(figsize=(8, 5))
sns.countplot(data=df, x='flood_occurred', palette='Set2')
plt.title('Distribution of Flood Events (0: No Flood, 1: Flood)')
plt.savefig(os.path.join(OUTPUT_DIR, "scratch", "dist_target.png"))
plt.close()

# Plot 2: Correlation Heatmap
plt.figure(figsize=(10, 8))
numeric_df = df.select_dtypes(include=['float64', 'int64'])
sns.heatmap(numeric_df.corr(), annot=True, cmap='coolwarm', fmt=".2f")
plt.title('Correlation Heatmap')
plt.savefig(os.path.join(OUTPUT_DIR, "scratch", "corr_heatmap.png"))
plt.close()

# Plot 3: Rainfall vs River Level colored by Flood Occurred
plt.figure(figsize=(10, 6))
sns.scatterplot(data=df, x='daily_rainfall_mm', y='river_level_m', hue='flood_occurred', palette='Set1', alpha=0.7)
plt.title('Daily Rainfall vs River Level')
plt.savefig(os.path.join(OUTPUT_DIR, "scratch", "scatter_rain_river.png"))
plt.close()

# Plot 4: Elevation Distribution
plt.figure(figsize=(10, 6))
sns.histplot(data=df, x='elevation_m', hue='flood_occurred', multiple="stack", palette='viridis')
plt.title('Elevation Distribution vs Flooding')
plt.savefig(os.path.join(OUTPUT_DIR, "scratch", "elevation_dist.png"))
plt.close()

# ==========================================
# 2. GENERATE JUPYTER NOTEBOOK
# ==========================================
print("Generating Jupyter Notebook...")

nb = nbf.v4.new_notebook()

# Notebook cells
cells = [
    nbf.v4.new_markdown_cell("# Exploratory Data Analysis (EDA) - Sri Lanka Flood Dataset\nThis notebook analyzes historical river levels, rainfall, and elevation to understand flood occurrences."),
    
    nbf.v4.new_code_cell("import pandas as pd\nimport matplotlib.pyplot as plt\nimport seaborn as sns\n\nsns.set_theme(style='whitegrid')"),
    
    nbf.v4.new_markdown_cell("## 1. Load the Data"),
    nbf.v4.new_code_cell(f"df = pd.read_csv(r'{DATA_PATH}')\ndf.head()"),
    
    nbf.v4.new_markdown_cell("## 2. Basic Information"),
    nbf.v4.new_code_cell("df.info()"),
    nbf.v4.new_code_cell("df.describe()"),
    
    nbf.v4.new_markdown_cell("## 3. Class Distribution"),
    nbf.v4.new_code_cell("plt.figure(figsize=(8, 5))\nsns.countplot(data=df, x='flood_occurred', palette='Set2')\nplt.title('Distribution of Flood Events (0: No Flood, 1: Flood)')\nplt.show()"),
    
    nbf.v4.new_markdown_cell("## 4. Correlation Analysis"),
    nbf.v4.new_code_cell("plt.figure(figsize=(10, 8))\nnumeric_df = df.select_dtypes(include=['float64', 'int64'])\nsns.heatmap(numeric_df.corr(), annot=True, cmap='coolwarm', fmt='.2f')\nplt.title('Correlation Heatmap')\nplt.show()"),
    
    nbf.v4.new_markdown_cell("## 5. Rainfall vs River Level"),
    nbf.v4.new_code_cell("plt.figure(figsize=(10, 6))\nsns.scatterplot(data=df, x='daily_rainfall_mm', y='river_level_m', hue='flood_occurred', palette='Set1', alpha=0.7)\nplt.title('Daily Rainfall vs River Level')\nplt.show()"),
    
    nbf.v4.new_markdown_cell("## 6. Impact of Elevation"),
    nbf.v4.new_code_cell("plt.figure(figsize=(10, 6))\nsns.histplot(data=df, x='elevation_m', hue='flood_occurred', multiple='stack', palette='viridis')\nplt.title('Elevation Distribution vs Flooding')\nplt.show()")
]

nb['cells'] = cells

with open(NOTEBOOK_PATH, 'w') as f:
    nbf.write(nb, f)

print(f"EDA complete! Notebook saved to {NOTEBOOK_PATH}")
