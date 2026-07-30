import psycopg2

def reset_voter(voter_name):
    try:
        conn = psycopg2.connect(database="voting_db", user="postgres", host="127.0.0.1")
        cur = conn.cursor()
        
        # Using parameterized query to prevent syntax errors
        query = "UPDATE voters SET has_voted = False, candidate_chosen = NULL, voted_at = NULL WHERE full_name = %s"
        cur.execute(query, (voter_name,))
        
        conn.commit()
        if cur.rowcount > 0:
            print(f"Status Reset: {voter_name} can now vote again!")
        else:
            print(f"Voter '{voter_name}' not found in database.")
            
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    reset_voter("Shinde.Mahadev.")
