import cv2, face_recognition, psycopg2, json

def register():
    name = input("Enter Voter's Full Name: ")
    cam = cv2.VideoCapture(0)
    print(f"Aligning camera for {name}. Press 'SPACE' to capture photo.")

    while True:
        ret, frame = cam.read()
        cv2.imshow("Voter Registration - Press SPACE to Capture", frame)
        
        if cv2.waitKey(1) % 256 == 32: # Space bar
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            encodings = face_recognition.face_encodings(rgb)
            
            if len(encodings) == 1:
                # Convert numpy array to list for JSON storage
                encoding_json = json.dumps(encodings[0].tolist())
                
                try:
                    conn = psycopg2.connect(database="voting_db", user="postgres", host="127.0.0.1")
                    cur = conn.cursor()
                    cur.execute("INSERT INTO voters (full_name, face_encoding, has_voted) VALUES (%s, %s, %s)", 
                                (name, encoding_json, False))
                    conn.commit()
                    conn.close()
                    print(f"\n[SUCCESS] {name} has been biometrically registered!")
                    break
                except Exception as e:
                    print(f"Database Error: {e}")
                    break
            else:
                print("Error: Ensure exactly one face is visible and try again.")
        
        if cv2.waitKey(1) % 256 == 27: # ESC to cancel
            break

    cam.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    register()
