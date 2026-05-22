import pg8000
import sys

passwords = ["", "admin", "root", "123456", "1234", "password", "postgres"]

for pwd in passwords:
    try:
        print(f"Testing password: '{pwd}'...")
        conn = pg8000.connect(
            user="postgres",
            password=pwd,
            host="localhost",
            port=5432,
            database="postgres"
        )
        conn.close()
        print(f"SUCCESS! Password is '{pwd}'")
        sys.exit(0)
    except Exception as e:
        print("Failed:", str(e))

print("All default passwords failed.")
sys.exit(1)
