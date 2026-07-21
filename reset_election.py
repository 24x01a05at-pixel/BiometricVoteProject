import psycopg2
import os
import glob

def total_reset():
    confirm = input("DANGER: This will delete ALL votes and PDF receipts. Type 'YES' to continue: ")
    if confirm == "YES":
        try:
            # 1. Clear the Database
            conn = psycopg2.connect(database="voting_db", user="postgres", host="127.0.0.1")
            cur = conn.cursor()
            cur.execute("UPDATE voters SET has_voted = False, candidate_chosen = NULL, voted_at = NULL")
            conn.commit()
            conn.close()
            print("[1/2] Database cleared successfully.")

            # 2. Delete PDF Receipts
            receipts = glob.glob("Receipt_*.pdf")
            for f in receipts:
                os.remove(f)
            print(f"[2/2] Deleted {len(receipts)} old PDF receipts.")
            
            print("\n--- SYSTEM READY FOR NEW ELECTION ---")
        except Exception as e:
            print(f"Error during reset: {e}")
    else:
        print("Reset cancelled.")

if __name__ == "__main__":
    total_reset()
