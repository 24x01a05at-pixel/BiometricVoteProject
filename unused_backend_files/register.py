import cv2
import face_recognition
import os

name = input("Enter Name: ").strip()
cam = cv2.VideoCapture(0)
path = "known_faces"
if not os.path.exists(path): os.makedirs(path)

while True:
    ret, frame = cam.read()
    cv2.imshow("Register - Press 'S' to Save", frame)
    if cv2.waitKey(1) & 0xFF == ord('s'):
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        if face_recognition.face_locations(rgb):
            cv2.imwrite(f"{path}/{name}.jpg", frame)
            print(f"Registered {name}!")
            break
        else:
            print("No face detected, try again.")
cam.release()
cv2.destroyAllWindows()