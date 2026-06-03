import os
import json
from pywebpush import webpush, WebPushException
from app.db import get_db_connection
from dotenv import load_dotenv

load_dotenv()

VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY")
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY")
VAPID_EMAIL = os.getenv("VAPID_EMAIL", "mailto:admin@floodpredict.lk")

def send_web_push(subscription_info, data_dict):
    """Sends a standard Web Push notification to a subscribed client browser."""
    if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
        print("VAPID keys not configured in .env. Skipping Web Push.")
        return False
        
    try:
        # Format claims
        vapid_claims = {
            "sub": VAPID_EMAIL
        }
        
        # Structure the payload
        payload = json.dumps(data_dict)
        
        response = webpush(
            subscription_info=subscription_info,
            data=payload,
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims=vapid_claims,
            ttl=86400
        )
        print(f"Web Push sent successfully. Status code: {response.status_code}")
        return True
    except WebPushException as ex:
        print(f"Web Push Exception: {ex}")
        # If subscription has expired/gone, we should remove it from the DB
        if ex.response is not None and ex.response.status_code in [404, 410]:
            print(f"Subscription expired (Status {ex.response.status_code}). Removing from database...")
            remove_subscription_by_endpoint(subscription_info.get("endpoint"))
        return False
    except Exception as e:
        print(f"Error sending Web Push notification: {e}")
        return False

def remove_subscription_by_endpoint(endpoint):
    """Removes expired push subscriptions from the database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM push_subscriptions WHERE endpoint = %s", (endpoint,))
        conn.commit()
    except Exception as e:
        print(f"Error removing expired subscription: {e}")
    finally:
        cursor.close()
        conn.close()

def broadcast_flood_alert(title, message, risk_level, district=None):
    """
    Broadcasts a flood alert to all registered subscribers.
    Also logs the alert in the system database for in-app alert lists.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Log the alert in the database
    alert_id = None
    try:
        cursor.execute("""
            INSERT INTO alerts (title, message, risk_level, district, is_active)
            VALUES (%s, %s, %s, %s, TRUE)
            RETURNING id
        """, (title, message, risk_level, district))
        alert_id = cursor.fetchone()[0]
        conn.commit()
        print(f"Alert logged in database. Alert ID: {alert_id}")
    except Exception as e:
        print(f"Error logging alert: {e}")
        conn.rollback()
        
    # 2. Fetch all active subscriptions
    subscriptions = []
    try:
        cursor.execute("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id IS NOT NULL")
        rows = cursor.fetchall()
        for r in rows:
            subscriptions.append({
                "endpoint": r[0],
                "keys": {
                    "p256dh": r[1],
                    "auth": r[2]
                }
            })
    except Exception as e:
        print(f"Error fetching push subscriptions: {e}")
    finally:
        cursor.close()
        conn.close()
        
    # 3. Broadcast Web Push notifications to all subscribers
    if not subscriptions:
        print("No active push subscriptions found. Alert broadcast complete.")
        return alert_id
        
    print(f"Broadcasting Web Push to {len(subscriptions)} subscribers...")
    push_payload = {
        "title": title,
        "body": message,
        "icon": "/logo192.png",
        "badge": "/badge.png",
        "data": {
            "risk_level": risk_level,
            "district": district,
            "url": "/"
        }
    }
    
    success_count = 0
    for sub in subscriptions:
        if send_web_push(sub, push_payload):
            success_count += 1
            
    print(f"Alert broadcast complete. Successfully pushed to {success_count}/{len(subscriptions)} devices.")
    return alert_id
