
import cv2
import face_recognition
import psycopg2
import json
import numpy as np

def enroll_voter():
    try:
        # Connect to DB
        conn = psycopg2.connect(database="voting_db", user="postgres", host="127.0.0.1")
        cur = conn.cursor()

        name = input("Enter Voter Full Name: ")
        
        print("\n[INFO] Opening webcam... Look at the camera.")
        print("[ACTION] Press SPACE to capture your face, or ESC to quit.")
        
        cam = cv2.VideoCapture(0)
        
        while True:
            ret, frame = cam.read()
            if not ret:
                print("Failed to grab frame")
                break
                
            # Mirror the frame for easier positioning
            display_frame = cv2.flip(frame, 1)
            cv2.imshow("Voter Registration - Press SPACE", display_frame)
            
            key = cv2.waitKey(1)
            if key == 32: # Spacebar
                # Convert BGR (OpenCV) to RGB (face_recognition)
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                
                # Detect face and encode it
                encodings = face_recognition.face_encodings(rgb_frame)
                
                if len(encodings) > 0:
                    # Convert numpy array to list for JSON storage
                    encoding_list = encodings[0].tolist()
                    encoding_json = json.dumps(encoding_list)
                    
                    # Insert into DB
                    cur.execute(
                        "INSERT INTO voters (full_name, face_encoding) VALUES (%s, %s)",
                        (name, encoding_json)
                    )
                    conn.commit()
                    print(f"\n[SUCCESS] {name} has been biometrically registered!")
                    break
                else:
                    print("\n[ERROR] No face detected. Please center your face and try again.")
            
            elif key == 27: # ESC
                break
                
        cam.release()
        cv2.destroyAllWindows()
        cur.close()
        conn.close()

    except Exception as e:
        print(f"\n[CRITICAL ERROR] {e}")

if __name__ == "__main__":
    enroll_voter()

