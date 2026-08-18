import pandas as pd

# Load dataset
df = pd.read_csv("D:\\flood_predict\\backend\\dataset\\sri_lanka_flood_dataset.csv")

# Basic Info
print("=== HEAD ===")
print(df.head())
print("\n=== INFO ===")
print(df.info())
print("\n=== MISSING VALUES ===")
print(df.isnull().sum())
print("\n=== DESCRIBE ===")
print(df.describe())
