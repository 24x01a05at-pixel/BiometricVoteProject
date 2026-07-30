import psycopg2

try:
    conn = psycopg2.connect(database="voting_db", user="postgres", host="127.0.0.1")
    cur = conn.cursor()
    
    # This query keeps only the first ID for every name and deletes others
    cur.execute("""
        DELETE FROM voters 
        WHERE id NOT IN (
            SELECT min(id) 
            FROM voters 
            GROUP BY full_name
        )
    """)
    
    conn.commit()
    print(f"Cleanup complete! Removed {cur.rowcount} duplicate entries.")
    conn.close()
except Exception as e:
    print(f"Error: {e}")
