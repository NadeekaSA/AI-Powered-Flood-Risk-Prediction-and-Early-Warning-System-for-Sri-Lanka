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
        
        # Regex to parse rows like:
        # | [Hanwella](https://...) | Kelani Ganga | Kelani Ganga | 8.1 | 🔺0.07 | 🟠 Minor Flood |
        row_pattern = re.compile(
            r'^\|\s*\[([^\]]+)\]\(([^|]+)\)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|'
        )
        
        # Let's check a more flexible pattern just in case there are no links, or different number of columns:
        # Some rows might have 6 columns (Gauging Station, River, River Basin, Level, Rate-of-Rise, Alert)
        flexible_pattern = re.compile(
            r'^\|\s*(?:\[([^\]]+)\]\([^\)]+\)|([^|]+))\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|'
        )

        for line in lines[2:]: # skip header and separator lines
            if not line.strip() or not line.startswith("|"):
                continue
                
            match = flexible_pattern.match(line)
            if not match:
                continue
                
            groups = match.groups()
            
            # Station Name is either in group 0 (linked) or group 1 (plain text)
            station_name = groups[0] if groups[0] else groups[1]
            if not station_name:
                continue
            
            station_name = station_name.strip()
            # Skip if it is part of the header separator or footer
            if station_name.startswith("---") or station_name == "Gauging Station":
                continue
                
            river_name = groups[2].strip()
            basin_name = groups[3].strip()
            current_level = clean_float(groups[4])
            rate_of_rise = clean_float(groups[5])
            
            # If the rate of rise had a down-arrow (🔻 or negative sign), make it negative
            raw_rise = groups[5]
            if "🔻" in raw_rise or "-" in raw_rise:
                rate_of_rise = -abs(rate_of_rise)
                
            alert_status = clean_status(groups[6])
            
            parsed_stations.append({
                "name": station_name,
                "river": river_name,
                "basin": basin_name,
                "level": current_level,
                "rise": rate_of_rise,
                "status": alert_status
            })
            
        if not parsed_stations:
            print("Warning: Parsed 0 stations from live Markdown table. Using mock updates.")
            return False
            
        print(f"Successfully parsed {len(parsed_stations)} gauging stations from DMC.")
        
        # Save to PostgreSQL database
        conn = get_db_connection()
        cursor = conn.cursor()
        
        updated_count = 0
        for s in parsed_stations:
            try:
                # Update current water levels, rate of rise, and alert status
                cursor.execute("""
                    UPDATE gauging_stations
                    SET current_level = %s,
                        rate_of_rise = %s,
                        alert_status = %s,
                        last_updated = CURRENT_TIMESTAMP
                    WHERE station_name = %s
                """, (s["level"], s["rise"], s["status"], s["name"]))
                
                # Check if it was updated, otherwise insert (if new station is found)
                cursor.execute("SELECT id FROM gauging_stations WHERE station_name = %s", (s["name"],))
                exists = cursor.fetchone()
                if not exists:
                    # Look up typical coordinates or assign default (e.g. Colombo coordinate)
                    cursor.execute("""
                        INSERT INTO gauging_stations (station_name, river_name, basin_name, latitude, longitude, current_level, rate_of_rise, alert_status)
                        VALUES (%s, %s, %s, 6.9, 79.9, %s, %s, %s)
                    """, (s["name"], s["river"], s["basin"], s["level"], s["rise"], s["status"]))
                    
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
