import psycopg2
import csv
from datetime import datetime

def backup():
    try:
        conn = psycopg2.connect(database="voting_db", user="postgres", host="127.0.0.1")
        cur = conn.cursor()
        
        # Fetch all data for voters who participated
        cur.execute("SELECT full_name, candidate_chosen, voted_at FROM voters WHERE has_voted = True")
        data = cur.fetchall()
        
        if not data:
            print("No votes found to backup.")
            return

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"Election_Backup_{timestamp}.csv"
        
        with open(filename, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["Voter Name", "Candidate Chosen", "Timestamp"])
            writer.writerows(data)
            
        print(f"\n[SUCCESS] Backup created: {filename}")
        conn.close()
    except Exception as e:
        print(f"Backup failed: {e}")

if __name__ == "__main__":
    backup()
