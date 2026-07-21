import psycopg2
try:
    conn = psycopg2.connect(database="voting_db", user="postgres", host="127.0.0.1")
    cur = conn.cursor()
    
    # Check if he exists
    cur.execute("SELECT name FROM candidates WHERE name = 'Monkey.D.Luffy'")
    if not cur.fetchone():
        cur.execute("INSERT INTO candidates (name, party_name) VALUES (%s, %s)", 
                    ('Monkey.D.Luffy', 'Straw Hat Pirates'))
        conn.commit()
        print("? Monkey.D.Luffy added to the database!")
    else:
        print("? Luffy is already in the database.")
        
    conn.close()
except Exception as e:
    print(f"? Error: {e}")
