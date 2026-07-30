import cv2
import face_recognition
import os
import numpy as np
from scipy.spatial import distance as dist

# Settings
EYE_AR_THRESH = 0.20  
COUNTER = 0

def get_ear(eye):
    A = dist.euclidean(eye[1], eye[5])
    B = dist.euclidean(eye[2], eye[4])
    C = dist.euclidean(eye[0], eye[3])
    return (A + B) / (2.0 * C)

def start_booth():
    global COUNTER
    path = "known_faces"
    known_encodings, known_names = [], []

    # Load Voters
    for file in os.listdir(path):
        if file.lower().endswith((".jpg", ".png")):
            img = face_recognition.load_image_file(os.path.join(path, file))
            enc = face_recognition.face_encodings(img)
            if enc:
                known_encodings.append(enc[0])
                known_names.append(os.path.splitext(file)[0])

    video = cv2.VideoCapture(0)
    print("Booth Active...")

    while True:
        ret, frame = video.read()
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Detect Faces
        face_locs = face_recognition.face_locations(rgb_frame)
        face_encs = face_recognition.face_encodings(rgb_frame, face_locs)
        face_lands = face_recognition.face_landmarks(rgb_frame, face_locs)

        for (top, right, bottom, left), enc, land in zip(face_locs, face_encs, face_lands):
            distances = face_recognition.face_distance(known_encodings, enc)
            name = "Unknown"

            if len(distances) > 0 and np.min(distances) < 0.6:
                name = known_names[np.argmin(distances)]
                
                # Blink Detection
                ear = (get_ear(land['left_eye']) + get_ear(land['right_eye'])) / 2.0
                if ear < EYE_AR_THRESH:
                    COUNTER += 1
                else:
                    if COUNTER >= 2: # Blink Verified
                        print(f"VOTE SUCCESS: {name}")
                        video.release()
                        cv2.destroyAllWindows()
                        return
                    COUNTER = 0

            # UI
            color = (0, 255, 0) if name != "Unknown" else (0, 0, 255)
            cv2.rectangle(frame, (left, top), (right, bottom), color, 2)
            cv2.putText(frame, f"{name}: Blink to Vote", (left, top-10), 1, 1.5, color, 2)

        cv2.imshow("Biometric Booth", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'): break

    video.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    start_booth()