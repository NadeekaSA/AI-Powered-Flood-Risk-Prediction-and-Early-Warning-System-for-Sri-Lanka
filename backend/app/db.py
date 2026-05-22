import os
import pg8000
from dotenv import load_dotenv
import math

# Load environment variables
load_dotenv()

DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", 5432))
DB_NAME = os.getenv("DB_NAME", "flood_predict")

def get_admin_connection():
    """Connects to the default 'postgres' database to perform admin tasks."""
    return pg8000.connect(
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT,
        database="postgres"
    )

def get_db_connection():
    """Connects to the application's specific 'flood_predict' database."""
    return pg8000.connect(
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME
    )

def init_database():
    """Creates the database, sets up schemas, and seeds initial data."""
    # Step 1: Create Database if it doesn't exist
    conn = get_admin_connection()
    conn.autocommit = True
    cursor = conn.cursor()
    
    try:
        # Check if database exists
        cursor.execute(f"SELECT 1 FROM pg_database WHERE datname = '{DB_NAME}'")
        exists = cursor.fetchone()
        if not exists:
            print(f"Creating database {DB_NAME}...")
            cursor.execute(f"CREATE DATABASE {DB_NAME}")
        else:
            print(f"Database {DB_NAME} already exists.")
    except Exception as e:
        print("Error checking/creating database:", e)
    finally:
        cursor.close()
        conn.close()

    # Step 2: Initialize tables & PostGIS (with graceful fallback)
    conn = get_db_connection()
    cursor = conn.cursor()
    
    postgis_available = False
    try:
        print("Checking/Enabling PostGIS extension...")
        cursor.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
        conn.commit()
        postgis_available = True
        print("PostGIS extension is enabled!")
    except Exception as e:
        print("PostGIS not available. Rolling back and falling back to standard coordinates...")
        conn.rollback() # Crucial! Clear the aborted transaction state

    # Start a fresh transaction block for creating tables
    try:
        print("Creating schemas and tables...")
        
        # 1. Users Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(20) DEFAULT 'public' CHECK (role IN ('public', 'admin')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # 2. Gauging Stations Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS gauging_stations (
                id SERIAL PRIMARY KEY,
                station_name VARCHAR(100) UNIQUE NOT NULL,
                river_name VARCHAR(100) NOT NULL,
                basin_name VARCHAR(100) NOT NULL,
                latitude DOUBLE PRECISION NOT NULL,
                longitude DOUBLE PRECISION NOT NULL,
                current_level DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                rate_of_rise DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                alert_status VARCHAR(50) DEFAULT 'Normal',
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        if postgis_available:
            try:
                cursor.execute("ALTER TABLE gauging_stations ADD COLUMN IF NOT EXISTS geom GEOMETRY(Point, 4326);")
            except Exception:
                pass
            
        # 3. Grid Cells Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS grid_cells (
                id SERIAL PRIMARY KEY,
                district VARCHAR(50) NOT NULL,
                latitude DOUBLE PRECISION NOT NULL,
                longitude DOUBLE PRECISION NOT NULL,
                elevation DOUBLE PRECISION NOT NULL,
                slope DOUBLE PRECISION NOT NULL,
                nearest_station_id INTEGER REFERENCES gauging_stations(id),
                distance_to_river DOUBLE PRECISION NOT NULL,
                drainage_density DOUBLE PRECISION DEFAULT 1.0
            );
        """)
        
        if postgis_available:
            try:
                cursor.execute("ALTER TABLE grid_cells ADD COLUMN IF NOT EXISTS geom GEOMETRY(Polygon, 4326);")
            except Exception:
                pass

        # 4. Grid Predictions History Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS grid_predictions (
                id SERIAL PRIMARY KEY,
                grid_id INTEGER REFERENCES grid_cells(id) ON DELETE CASCADE,
                daily_rainfall DOUBLE PRECISION NOT NULL,
                three_day_cumulative DOUBLE PRECISION NOT NULL,
                weekly_trend DOUBLE PRECISION NOT NULL,
                predicted_risk_level VARCHAR(20) NOT NULL CHECK (predicted_risk_level IN ('Low', 'Medium', 'High', 'Critical')),
                predicted_risk_prob DOUBLE PRECISION NOT NULL,
                estimated_depth DOUBLE PRECISION,
                run_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # 5. Push Subscriptions Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                endpoint TEXT NOT NULL UNIQUE,
                p256dh VARCHAR(255) NOT NULL,
                auth VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # 6. Active Alerts Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS alerts (
                id SERIAL PRIMARY KEY,
                title VARCHAR(200) NOT NULL,
                message TEXT NOT NULL,
                risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('Low', 'Medium', 'High', 'Critical')),
                district VARCHAR(50),
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        conn.commit()
        print("Tables created successfully.")
        
        # Step 3: Seed Gauging Stations
        seed_gauging_stations(cursor, postgis_available)
        conn.commit()

        # Step 4: Seed Grid Cells
        seed_grid_cells(cursor, postgis_available)
        conn.commit()
        
        print("Database initialization complete!")
        
    except Exception as e:
        print("Error initializing schema:", e)
        conn.rollback()
    finally:
        cursor.close()
        conn.close()

def seed_gauging_stations(cursor, postgis_available):
    """Seeds the 12 primary gauging stations in Sri Lanka."""
    stations = [
        {"name": "Hanwella", "river": "Kelani Ganga", "basin": "Kelani Ganga", "lat": 6.9105, "lon": 80.0813},
        {"name": "Dunamale", "river": "Attanagalu Oya", "basin": "Attanagalu Oya", "lat": 7.1130, "lon": 80.0790},
        {"name": "Rathnapura", "river": "Kalu Ganga", "basin": "Kalu Ganga", "lat": 6.6899, "lon": 80.3803},
        {"name": "Kalawellawa", "river": "Kuda Ganga", "basin": "Kalu Ganga", "lat": 6.6315, "lon": 80.1607},
        {"name": "Nagalagam Street", "river": "Kelani Ganga", "basin": "Kelani Ganga", "lat": 6.9603, "lon": 79.8786},
        {"name": "Magura", "river": "Maguru Ganga", "basin": "Kalu Ganga", "lat": 6.5137, "lon": 80.2440},
        {"name": "Glencourse", "river": "Kelani Ganga", "basin": "Kelani Ganga", "lat": 6.9757, "lon": 80.1866},
        {"name": "Baddegama", "river": "Gin Ganga", "basin": "Gin Ganga", "lat": 6.1775, "lon": 80.1805},
        {"name": "Panadugama", "river": "Nilwala Ganga", "basin": "Nilwala Ganga", "lat": 6.1101, "lon": 80.4807},
        {"name": "Putupaula", "river": "Kalu Ganga", "basin": "Kalu Ganga", "lat": 6.6116, "lon": 80.0597},
        {"name": "Ellagawa", "river": "Kalu Ganga", "basin": "Kalu Ganga", "lat": 6.7304, "lon": 80.2131},
        {"name": "Giriulla", "river": "Maha Oya", "basin": "Maha Oya", "lat": 7.3303, "lon": 80.1243}
    ]
    
    print("Seeding gauging stations...")
    for s in stations:
        try:
            cursor.execute("SELECT id FROM gauging_stations WHERE station_name = %s", (s["name"],))
            res = cursor.fetchone()
            if not res:
                if postgis_available:
                    cursor.execute("""
                        INSERT INTO gauging_stations (station_name, river_name, basin_name, latitude, longitude, geom)
                        VALUES (%s, %s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326))
                    """, (s["name"], s["river"], s["basin"], s["lat"], s["lon"], s["lon"], s["lat"]))
                else:
                    cursor.execute("""
                        INSERT INTO gauging_stations (station_name, river_name, basin_name, latitude, longitude)
                        VALUES (%s, %s, %s, %s, %s)
                    """, (s["name"], s["river"], s["basin"], s["lat"], s["lon"]))
        except Exception as e:
            print(f"Error seeding station {s['name']}: {e}")

def seed_grid_cells(cursor, postgis_available):
    """Generates and seeds a grid of ~60 cells covering highly flood-prone basins in Sri Lanka."""
    cursor.execute("SELECT count(*) FROM grid_cells")
    count = cursor.fetchone()[0]
    if count > 0:
        print("Grid cells already seeded.")
        return
        
    print("Seeding spatial prediction grids...")
    
    cursor.execute("SELECT id, station_name, latitude, longitude, basin_name FROM gauging_stations")
    stations = cursor.fetchall()
    
    district_map = {
        "Kelani Ganga": "Colombo",
        "Kalu Ganga": "Kalutara",
        "Attanagalu Oya": "Gampaha",
        "Gin Ganga": "Galle",
        "Nilwala Ganga": "Matara",
        "Maha Oya": "Kurunegala"
    }
    
    for station_id, name, s_lat, s_lon, basin in stations:
        district = district_map.get(basin, "Colombo")
        if name == "Rathnapura":
            district = "Ratnapura"
            
        # Create a 2x2 grid centered around each gauging station to keep it efficient (~48 cells total)
        step = 0.009
        for dx in [-1, 0, 1]:
            for dy in [-1, 0, 1]:
                cell_lat = s_lat + dy * step
                cell_lon = s_lon + dx * step
                
                # Distance to the gauging station in km
                dist = math.sqrt((dx * step * 111)**2 + (dy * step * 111)**2)
                
                # Elevation logic: closer to rivers = lower elevation.
                base_el = 15.0
                if district in ["Colombo", "Gampaha", "Matara", "Galle"]:
                    base_el = 4.0
                elif district == "Ratnapura":
                    base_el = 30.0
                
                elevation = max(1.2, base_el + dist * 10.0 - abs(dx + dy) * 1.5)
                slope = max(0.1, 0.4 + dist * 1.8)
                
                # Create a polygon boundary
                half_step = step / 2.0
                p1_lon, p1_lat = cell_lon - half_step, cell_lat - half_step
                p2_lon, p2_lat = cell_lon + half_step, cell_lat - half_step
                p3_lon, p3_lat = cell_lon + half_step, cell_lat + half_step
                p4_lon, p4_lat = cell_lon - half_step, cell_lat + half_step
                
                wkt_poly = f"POLYGON(({p1_lon} {p1_lat}, {p2_lon} {p2_lat}, {p3_lon} {p3_lat}, {p4_lon} {p4_lat}, {p1_lon} {p1_lat}))"
                
                try:
                    if postgis_available:
                        cursor.execute("""
                            INSERT INTO grid_cells (district, latitude, longitude, elevation, slope, nearest_station_id, distance_to_river, geom)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, ST_GeomFromText(%s, 4326))
                        """, (district, cell_lat, cell_lon, elevation, slope, station_id, dist, wkt_poly))
                    else:
                        cursor.execute("""
                            INSERT INTO grid_cells (district, latitude, longitude, elevation, slope, nearest_station_id, distance_to_river)
                            VALUES (%s, %s, %s, %s, %s, %s, %s)
                        """, (district, cell_lat, cell_lon, elevation, slope, station_id, dist))
                except Exception as e:
                    print(f"Error seeding grid cell near {name}: {e}")
                    
    print("Grid cells seeding complete.")

if __name__ == "__main__":
    init_database()
