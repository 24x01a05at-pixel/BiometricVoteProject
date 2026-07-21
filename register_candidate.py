import psycopg2
import os

def register_candidate():
    print("\n--- NEW CANDIDATE REGISTRATION ---")
    name = input("Enter Candidate Name: ").strip()
    party = input("Enter Party Name: ").strip()
    
    photo_input = input("Enter Path to Candidate Photo: ").strip().replace('"', '')

    # List of possible extensions to check if user forgot one
    extensions = ['', '.png', '.jpg', '.jpeg', '.JPG', '.PNG']
    photo = None
    
    for ext in extensions:
        test_path = photo_input + ext
        if os.path.exists(test_path):
            photo = test_path
            break

    if not photo:
        print(f"\n[ERROR] File not found! Tried: {photo_input} with various extensions.")
        print(f"Current Working Directory: {os.getcwd()}")
        return

    try:
        conn = psycopg2.connect(database="voting_db", user="postgres", host="127.0.0.1")
        cur = conn.cursor()
        cur.execute("INSERT INTO candidates (name, party_name, photo_path) VALUES (%s, %s, %s)", (name, party, photo))
        conn.commit()
        print(f"\n[SUCCESS] Candidate '{name}' registered using photo at: {photo}")
        conn.close()
    except Exception as e:
        print(f"Database Error: {e}")

if __name__ == "__main__":
    register_candidate()
