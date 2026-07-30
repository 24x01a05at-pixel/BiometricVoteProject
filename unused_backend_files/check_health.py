
import cv2
import face_recognition
import psycopg2
import numpy as np

print("--- SYSTEM CHECK ---")
try:
    # 1. Test Database
    conn = psycopg2.connect(database="voting_db", user="postgres", host="127.0.0.1")
    print("? Database: Connected to voting_db")
    conn.close()
    
    # 2. Test Face Logic
    print(f"? Face Logic: dlib/face_recognition Loaded")
    
    # 3. Test Camera
    cap = cv2.VideoCapture(0)
    if cap.isOpened():
        print("? Camera: Accessible")
        cap.release()
    else:
        print("? Camera: Not detected")

    print("\n[RESULT] Everything is ready. Let us start coding!")
except Exception as e:
    print(f"\n? Error: {e}")

