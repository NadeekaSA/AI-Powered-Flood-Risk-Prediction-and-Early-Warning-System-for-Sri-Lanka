import re
import requests
from app.db import get_db_connection

DMC_README_URL = "https://raw.githubusercontent.com/nuuuwan/lk_dmc_vis/main/README.md"

def clean_float(value_str):
    """Cleans a string and converts it to float, stripping emojis and signs."""
    if not value_str:
        return 0.0
    value_str = value_str.strip()
    # Strip emojis and signs like 🔺 or 🔻
    cleaned = re.sub(r'[^\d\.\-]', '', value_str)
    try:
        return float(cleaned)
    except ValueError:
        return 0.0

def clean_status(status_str):
    """Cleans the alert status string, stripping colored circle emojis."""
    if not status_str:
        return "Normal"
    status_str = status_str.strip()
    # Strip colored circles: 🟢, 🟡, 🟠, 🔴, 🟤, etc.
    cleaned = re.sub(r'[^\w\s]', '', status_str).strip()
    return cleaned if cleaned else "Normal"

def scrape_dmc_data():
    """Scrapes the live DMC gauging station markdown table and updates the database."""
    print("Scraping live hydrology data from DMC repository...")
    try:
        response = requests.get(DMC_README_URL, timeout=10)
        if response.status_code != 200:
            print(f"Error: Failed to fetch DMC README. Status: {response.status_code}")
            return False
        
        content = response.text
        
        # Locate the Summary Table in Markdown
        # Find the line with column headers
        table_start_idx = content.find("| Gauging Station |")
        if table_start_idx == -1:
            print("Error: Could not locate Gauging Station table in README.")
            return False
            
        # Extract lines starting from the header
        lines = content[table_start_idx:].split("\n")
        
        parsed_stations = []
        
        # Capture name and URL if present, or plain text name if not
        flexible_pattern = re.compile(
            r'^\|\s*(?:\[([^\]]+)\]\(([^)]+)\)|([^|]+))\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|'
        )

        for line in lines[2:]: # skip header and separator lines
            if not line.strip() or not line.startswith("|"):
                continue
                
            match = flexible_pattern.match(line)
            if not match:
                continue
                
            groups = match.groups()
            
            # Station Name is either in group 0 (linked) or group 2 (plain text)
            station_name = groups[0] if groups[0] else groups[2]
            if not station_name:
                continue
            
            station_name = station_name.strip()
            # Skip if it is part of the header separator or footer
            if station_name.startswith("---") or station_name == "Gauging Station":
                continue
                
            url = groups[1].strip() if groups[1] else None
            river_name = groups[3].strip()
            basin_name = groups[4].strip()
            current_level = clean_float(groups[5])
            rate_of_rise = clean_float(groups[6])
            
            # If the rate of rise had a down-arrow (🔻 or negative sign), make it negative
            raw_rise = groups[6]
            if raw_rise and ("🔻" in raw_rise or "-" in raw_rise):
                rate_of_rise = -abs(rate_of_rise)
                
            alert_status = clean_status(groups[7])
            
            # Parse coordinates from URL
            lat, lon = 6.9, 79.9
            if url:
                coord_match = re.search(r'([\d\.\-]+),([\d\.\-]+)', url)
                if coord_match:
                    try:
                        lat = float(coord_match.group(1))
                        lon = float(coord_match.group(2))
                    except ValueError:
                        pass
            
            parsed_stations.append({
                "name": station_name,
                "river": river_name,
                "basin": basin_name,
                "level": current_level,
                "rise": rate_of_rise,
                "status": alert_status,
                "latitude": lat,
                "longitude": lon
            })
            
        if not parsed_stations:
            print("Warning: Parsed 0 stations from live Markdown table. Using mock updates.")
            return False
            
        print(f"Successfully parsed {len(parsed_stations)} gauging stations from DMC.")
        
        # Save to PostgreSQL database
        conn = get_db_connection()
        cursor = conn.cursor()
        
        from app.db import create_grid_cells_for_station, is_postgis_available
        postgis = is_postgis_available(cursor)
        
        updated_count = 0
        for s in parsed_stations:
            try:
                # Check if station exists
                cursor.execute("SELECT id FROM gauging_stations WHERE station_name = %s", (s["name"],))
                exists = cursor.fetchone()
                
                if exists:
                    station_id = exists[0]
                    # Update current water levels, rate of rise, alert status, and coordinates
                    cursor.execute("""
                        UPDATE gauging_stations
                        SET current_level = %s,
                            rate_of_rise = %s,
                            alert_status = %s,
                            latitude = %s,
                            longitude = %s,
                            river_name = %s,
                            basin_name = %s,
                            last_updated = CURRENT_TIMESTAMP
                        WHERE id = %s
                    """, (s["level"], s["rise"], s["status"], s["latitude"], s["longitude"], s["river"], s["basin"], station_id))
                    
                    if postgis:
                        cursor.execute("""
                            UPDATE gauging_stations
                            SET geom = ST_SetSRID(ST_MakePoint(%s, %s), 4326)
                            WHERE id = %s
                        """, (s["longitude"], s["latitude"], station_id))
                else:
                    # Insert new station with correct coordinates
                    if postgis:
                        cursor.execute("""
                            INSERT INTO gauging_stations (station_name, river_name, basin_name, latitude, longitude, current_level, rate_of_rise, alert_status, geom)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326))
                        """, (s["name"], s["river"], s["basin"], s["latitude"], s["longitude"], s["level"], s["rise"], s["status"], s["longitude"], s["latitude"]))
                    else:
                        cursor.execute("""
                            INSERT INTO gauging_stations (station_name, river_name, basin_name, latitude, longitude, current_level, rate_of_rise, alert_status)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        """, (s["name"], s["river"], s["basin"], s["latitude"], s["longitude"], s["level"], s["rise"], s["status"]))
                    
                    # Get the inserted station id
                    cursor.execute("SELECT id FROM gauging_stations WHERE station_name = %s", (s["name"],))
                    station_id = cursor.fetchone()[0]
                
                # Make sure 3x3 grid cells exist for this station!
                create_grid_cells_for_station(cursor, station_id, s["name"], s["latitude"], s["longitude"], s["basin"], postgis)
                
                updated_count += 1
            except Exception as e:
                print(f"Error saving station data for {s['name']}: {e}")
                
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"Database updated successfully with {updated_count} station records.")
        return True
        
    except Exception as e:
        print("Exception in DMC Scraper service:", e)
        return False

if __name__ == "__main__":
    scrape_dmc_data()
