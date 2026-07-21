# 🗳️ Biometric Voting System

A secure, multi-portal web application for electronic voting powered by **Python Flask**, **OpenCV**, **Face Recognition (128-d encodings)**, and **PostgreSQL**.

---

## ✨ Features

- **Biometric Voter Enrollment**: Live facial scanning captures 128-d face encodings to prevent duplicate voter registrations.
- **Candidate Nomination Portal**: Public nomination portal with party logo / photo uploads, requiring Admin Control Center approval.
- **Biometric Voting Booth**: Facial verification at booth ensures each registered voter can cast a confidential vote exactly once.
- **Admin Control Center**: Password-protected dashboard with customizable election timers, candidate approvals, voter management, and election restart controls.
- **NOTA ("None of the Above") Support**: System NOTA option with non-winner electoral rules (if NOTA finishes 1st, the 2nd highest actual candidate wins).
- **Certified Election Results & Winner Certificate**: Locked results during voting and automatic winner certificate generation.

---

## 🛠️ Tech Stack

- **Backend**: Python 3, Flask, psycopg2
- **Biometrics & Vision**: `face_recognition`, OpenCV (`cv2`), NumPy
- **Database**: PostgreSQL (`voting_db`)
- **Frontend**: HTML5, Vanilla CSS3, Bootstrap 5, Bootstrap Icons

---

## 🚀 Quick Setup

1. **Clone Repository**:
   ```bash
   git clone https://github.com/24x01a05at-pixel/BiometricVoteProject.git
   cd BiometricVoteProject
   ```

2. **Install Dependencies**:
   ```bash
   pip install flask psycopg2-binary opencv-python face_recognition numpy werkzeug
   ```

3. **Initialize Database**:
   Ensure PostgreSQL is running locally on port 5432 with database `voting_db`, then start the app:
   ```bash
   python app.py
   ```

4. **Access Portals**:
   - **Home Portal**: `http://127.0.0.1:5000/`
   - **Admin Control Center**: `http://127.0.0.1:5000/admin` (Default password: `admin123`)
