
import psycopg2

def add_candidate():
    try:
        conn = psycopg2.connect(database="voting_db", user="postgres", host="127.0.0.1")
        cur = conn.cursor()
        
        name = input("Enter Candidate Full Name: ")
        party = input("Enter Party Name: ")
        
        cur.execute("INSERT INTO candidates (name, party_name) VALUES (%s, %s)", (name, party))
        conn.commit()
        
        print(f"\n[SUCCESS] {name} from {party} has been added to the ballot!")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    add_candidate()

