from flask import Flask, render_template, session, redirect, url_for, request, jsonify, make_response
import psycopg2, psycopg2.extras, cv2, face_recognition
import numpy as np, json, base64, os
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.secret_key = "super_secret_biometric_voting_key"

UPLOAD_FOLDER = os.path.join(app.root_path, 'static', 'uploads')
VOTER_UPLOADS_FOLDER = os.path.join(app.root_path, 'static', 'uploads', 'voters')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(VOTER_UPLOADS_FOLDER, exist_ok=True)

def get_db_connection():
    return psycopg2.connect(host="127.0.0.1", database="voting_db", user="postgres", password="")

def save_uploaded_logo(file_obj):
    if file_obj and file_obj.filename:
        filename = secure_filename(file_obj.filename)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_")
        saved_filename = timestamp + filename
        file_path = os.path.join(UPLOAD_FOLDER, saved_filename)
        file_obj.save(file_path)
        return f"/static/uploads/{saved_filename}"
    return None

def save_voter_capture_photo(frame, voter_name):
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = "".join([c if c.isalnum() else "_" for c in voter_name])
    filename = f"{safe_name}_{timestamp}.jpg"
    file_path = os.path.join(VOTER_UPLOADS_FOLDER, filename)
    cv2.imwrite(file_path, frame)
    return f"/static/uploads/voters/{filename}"

def get_election_state():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    cur.execute("SELECT status, end_time, admin_password FROM election_config WHERE id = 1")
    row = cur.fetchone()
    conn.close()
    if not row:
        return {'status': 'NOT_STARTED', 'end_time': None, 'admin_password': 'admin123', 'time_remaining': 0}
    
    status = row['status']
    end_time = row['end_time']
    time_remaining = 0
    
    if status == 'ACTIVE' and end_time:
        now = datetime.now()
        if now >= end_time:
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("UPDATE election_config SET status = 'CLOSED' WHERE id = 1")
            conn.commit()
            conn.close()
            status = 'CLOSED'
            time_remaining = 0
        else:
            time_remaining = int((end_time - now).total_seconds())
            
    return {
        'status': status,
        'end_time': end_time.strftime("%Y-%m-%dT%H:%M:%S") if end_time else None,
        'admin_password': row['admin_password'],
        'time_remaining': time_remaining
    }

def decode_base64_image(base64_str):
    if ',' in base64_str:
        base64_str = base64_str.split(',')[1]
    img_bytes = base64.b64decode(base64_str)
    nparr = np.frombuffer(img_bytes, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    return frame, rgb_frame

def check_duplicate_face(rgb_frame):
    encodings = face_recognition.face_encodings(rgb_frame)
    if not encodings:
        return True, "No face detected in the image. Please align your face clearly with the camera.", None
    
    new_encoding = encodings[0]
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    cur.execute("SELECT id, full_name, face_encoding FROM voters WHERE face_encoding IS NOT NULL")
    voters = cur.fetchall()
    conn.close()
    
    known_encodings = []
    known_names = []
    
    for v in voters:
        try:
            enc_list = json.loads(v['face_encoding'])
            known_encodings.append(np.array(enc_list))
            known_names.append(v['full_name'])
        except Exception:
            continue
            
    if len(known_encodings) > 0:
        matches = face_recognition.compare_faces(known_encodings, new_encoding, tolerance=0.52)
        distances = face_recognition.face_distance(known_encodings, new_encoding)
        best_match_index = np.argmin(distances) if len(distances) > 0 else None
        
        if best_match_index is not None and matches[best_match_index]:
            matched_name = known_names[best_match_index]
            return True, f"Registration Blocked: A voter with this face is ALREADY registered as '{matched_name}'!", new_encoding
            
    return False, None, new_encoding

# --- ROUTES ---

@app.route('/')
def home():
    state = get_election_state()
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    cur.execute("SELECT COUNT(*) FROM voters")
    v_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM voters WHERE has_voted = TRUE")
    voted_count = cur.fetchone()[0]
    pending_v_count = v_count - voted_count
    
    cur.execute("SELECT COUNT(*) FROM candidates WHERE approved = TRUE")
    c_count = cur.fetchone()[0]
    conn.close()
    return render_template('home.html', state=state, voter_count=v_count, voted_count=voted_count, pending_v_count=pending_v_count, candidate_count=c_count)

@app.route('/voter/register', methods=['GET', 'POST'])
def voter_register():
    state = get_election_state()
    
    if request.method == 'POST':
        name = request.form.get('voter_name', '').strip()
        image_data = request.form.get('image_data', '')
        
        if not name:
            return jsonify({'status': 'fail', 'message': 'Voter name is required.'})
        if not image_data:
            return jsonify({'status': 'fail', 'message': 'Camera image capture is required.'})
            
        try:
            frame, rgb_frame = decode_base64_image(image_data)
            is_dup, err_msg, encoding = check_duplicate_face(rgb_frame)
            
            if is_dup:
                return jsonify({'status': 'fail', 'message': err_msg})
                
            capture_path = save_voter_capture_photo(frame, name)
            encoding_json = json.dumps(encoding.tolist())
            
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("INSERT INTO voters (full_name, face_encoding, has_voted, capture_path) VALUES (%s, %s, FALSE, %s)",
                        (name, encoding_json, capture_path))
            conn.commit()
            conn.close()
            
            return jsonify({'status': 'success', 'message': f"Voter '{name}' registered successfully with biometric face encoding and photo!"})
        except Exception as e:
            return jsonify({'status': 'fail', 'message': f"Error during face registration: {e}"})
            
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    cur.execute("SELECT id, full_name, has_voted, capture_path FROM voters ORDER BY id DESC")
    voters = cur.fetchall()
    conn.close()
    return render_template('voter_reg.html', state=state, voters=voters)

@app.route('/candidate/register', methods=['GET', 'POST'])
def candidate_register():
    state = get_election_state()
    message = None
    msg_type = 'success'
    
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        party = request.form.get('party', '').strip()
        
        if name and party:
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("SELECT id FROM candidates WHERE LOWER(name) = LOWER(%s)", (name,))
            if cur.fetchone():
                message = f"Nomination Rejected: A candidate named '{name}' is already nominated or registered."
                msg_type = 'danger'
                conn.close()
            else:
                logo_path = save_uploaded_logo(request.files.get('logo_file'))
                cur.execute("INSERT INTO candidates (name, party_name, logo_path, votes, approved) VALUES (%s, %s, %s, 0, FALSE)", (name, party, logo_path))
                conn.commit()
                conn.close()
                message = f"Nomination submitted for '{name}' ({party}). Pending Admin Approval!"
        else:
            message = "Candidate Name and Party Name are required."
            msg_type = 'danger'
            
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    cur.execute("SELECT name, party_name, logo_path, approved FROM candidates ORDER BY id DESC")
    all_cands = cur.fetchall()
    conn.close()
    
    return render_template('candidate_reg.html', state=state, tie=False, message=message, msg_type=msg_type, candidates=all_cands)

@app.route('/admin', methods=['GET', 'POST'])
def admin_portal():
    state = get_election_state()
    error = None
    success_msg = None
    action = request.form.get('admin_action')
    pwd = request.form.get('login_password') or request.form.get('auth_pass')
    
    is_authenticated = (pwd == state['admin_password'])
    
    if request.method == 'POST' and not is_authenticated:
        error = "Invalid Admin Password!"

    if is_authenticated and action:
        conn = get_db_connection()
        cur = conn.cursor()
        
        if action == 'candidate_tie_vote':
            voter_id = request.form.get('voting_candidate_id')
            target_id = request.form.get('target_candidate_id')
            if voter_id and target_id:
                cur.execute("UPDATE candidates SET has_tie_voted = TRUE WHERE id = %s", (voter_id,))
                cur.execute("UPDATE candidates SET tie_votes = COALESCE(tie_votes, 0) + 1 WHERE id = %s", (target_id,))
                conn.commit()
                success_msg = "Candidate tie-breaker vote successfully registered!"
            
        elif action == 'change_password':
            curr_p = request.form.get('current_password', '')
            new_p = request.form.get('new_password', '').strip()
            conf_p = request.form.get('confirm_password', '').strip()
            
            if curr_p != state['admin_password']:
                error = "Password Change Failed: Current password is incorrect."
            elif new_p != conf_p:
                error = "Password Change Failed: New passwords do not match."
            elif len(new_p) < 4:
                error = "Password Change Failed: New password must be at least 4 characters long."
            else:
                cur.execute("UPDATE election_config SET admin_password = %s WHERE id = 1", (new_p,))
                conn.commit()
                pwd = new_p  # update active password for this render
                success_msg = "Admin Password changed successfully!"
                
        elif action == 'start_election':
            try:
                duration = int(request.form.get('duration', 10))
                end_time = datetime.now() + timedelta(minutes=duration)
                cur.execute("UPDATE election_config SET status = 'ACTIVE', end_time = %s WHERE id = 1", (end_time,))
                conn.commit()
            except Exception as e:
                print(f"Error starting election: {e}")
                
        elif action == 'extend_election':
            try:
                add_mins = int(request.form.get('additional_minutes', 5))
                cur.execute("SELECT end_time FROM election_config WHERE id = 1")
                row = cur.fetchone()
                curr_end = row[0] if row and row[0] else datetime.now()
                if curr_end < datetime.now():
                    curr_end = datetime.now()
                new_end = curr_end + timedelta(minutes=add_mins)
                cur.execute("UPDATE election_config SET end_time = %s, status = 'ACTIVE' WHERE id = 1", (new_end,))
                conn.commit()
            except Exception as e:
                print(f"Error extending election: {e}")
                
        elif action == 'stop_election':
            cur.execute("UPDATE election_config SET status = 'CLOSED', end_time = NULL WHERE id = 1")
            conn.commit()
            
        elif action == 'reset_election':
            confirm_pwd = request.form.get('admin_password')
            if confirm_pwd == state['admin_password']:
                cur.execute("UPDATE candidates SET votes = 0, tie_votes = 0, has_tie_voted = FALSE")
                cur.execute("UPDATE voters SET has_voted = FALSE, candidate_chosen = NULL, voted_at = NULL")
                cur.execute("UPDATE election_config SET status = 'NOT_STARTED', end_time = NULL WHERE id = 1")
                conn.commit()
            else:
                error = "Incorrect Reset Confirmation Password!"
                
        elif action == 'approve_candidate':
            cand_id = request.form.get('candidate_id')
            cur.execute("UPDATE candidates SET approved = TRUE WHERE id = %s", (cand_id,))
            conn.commit()
            
        elif action == 'delete_candidate':
            cand_id = request.form.get('candidate_id')
            cur.execute("SELECT name FROM candidates WHERE id = %s", (cand_id,))
            cand = cur.fetchone()
            if cand and cand[0].strip().upper() != 'NOTA':
                cur.execute("DELETE FROM candidates WHERE id = %s", (cand_id,))
                conn.commit()
                
        elif action == 'delete_voter':
            voter_id = request.form.get('voter_id')
            cur.execute("DELETE FROM voters WHERE id = %s", (voter_id,))
            conn.commit()
                
        conn.close()
        state = get_election_state()

    if not is_authenticated:
        return render_template('admin.html', logged_in=False, error=error, state=state)

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    cur.execute("SELECT COUNT(*) FROM voters"); total_reg = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM voters WHERE has_voted = TRUE"); voted_count = cur.fetchone()[0]
    pending_count = total_reg - voted_count
    turnout = round((voted_count / total_reg * 100), 1) if total_reg > 0 else 0.0
    
    # Approved Candidates
    cur.execute("SELECT id, name, party_name, logo_path, COALESCE(votes, 0) AS votes, COALESCE(tie_votes, 0) AS tie_votes, has_tie_voted FROM candidates WHERE approved = TRUE ORDER BY votes DESC")
    approved_cands = cur.fetchall()
    
    cur.execute("SELECT id, name, party_name, logo_path FROM candidates WHERE approved = FALSE ORDER BY id DESC")
    pending_cands = cur.fetchall()
    
    cur.execute("SELECT id, full_name, has_voted, candidate_chosen, voted_at, capture_path FROM voters ORDER BY id DESC")
    voters = cur.fetchall()
    
    # Check for active tie-breaker voting requirements
    actual_candidates = [c for c in approved_cands if c['name'].strip().upper() != 'NOTA']
    tie = False
    tied_candidates = []
    pending_tie_voters = []
    
    if state['status'] == 'CLOSED' and actual_candidates:
        max_votes = max(c['votes'] for c in actual_candidates)
        if max_votes > 0:
            tied_candidates = [c for c in actual_candidates if c['votes'] == max_votes]
            if len(tied_candidates) > 1:
                # Find which candidates haven't voted yet in the tie-breaker
                pending_tie_voters = [c for c in actual_candidates if not c['has_tie_voted']]
                # A tie-breaker is active if at least one candidate hasn't voted yet
                if len(pending_tie_voters) > 0:
                    tie = True
                
    conn.close()

    return render_template('admin.html', logged_in=True, auth_pass=pwd, error=error, success_msg=success_msg, state=state, total_reg=total_reg, voted_count=voted_count, pending_count=pending_count, turnout=turnout, approved_candidates=approved_cands, pending_candidates=pending_cands, voters=voters, tie=tie, tied_candidates=tied_candidates, pending_tie_voters=pending_tie_voters)

@app.route('/admin/logout')
def admin_logout():
    return redirect('/admin')

@app.route('/booth')
def booth_landing():
    state = get_election_state()
    return render_template('booth.html', state=state)

@app.route('/run_booth', methods=['POST'])
def run_booth():
    state = get_election_state()
    if state['status'] != 'ACTIVE':
        return jsonify({'status': 'fail', 'message': 'Voting is currently closed!'})
        
    image_data = request.form.get('image_data', '')
    if not image_data:
        return jsonify({'status': 'fail', 'message': 'No image captured.'})
        
    try:
        frame, rgb_frame = decode_base64_image(image_data)
        encodings = face_recognition.face_encodings(rgb_frame)
        
        if not encodings:
            return jsonify({'status': 'fail', 'message': 'No face detected. Please face the camera directly.'})
            
        user_enc = encodings[0]
        
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cur.execute("SELECT id, full_name, face_encoding, has_voted FROM voters WHERE face_encoding IS NOT NULL")
        voters = cur.fetchall()
        conn.close()
        
        known_encs = []
        voter_records = []
        
        for v in voters:
            try:
                known_encs.append(np.array(json.loads(v['face_encoding'])))
                voter_records.append(v)
            except Exception:
                continue
                
        if len(known_encs) == 0:
            return jsonify({'status': 'fail', 'message': 'No registered voters found in database.'})
            
        matches = face_recognition.compare_faces(known_encs, user_enc, tolerance=0.52)
        distances = face_recognition.face_distance(known_encs, user_enc)
        best_idx = np.argmin(distances) if len(distances) > 0 else None
        
        if best_idx is not None and matches[best_idx]:
            matched_voter = voter_records[best_idx]
            if matched_voter['has_voted']:
                return jsonify({'status': 'fail', 'message': f"Access Denied: Voter '{matched_voter['full_name']}' has ALREADY cast a vote!"})
            
            session['verified_voter_id'] = matched_voter['id']
            session['verified_voter_name'] = matched_voter['full_name']
            return jsonify({'status': 'success', 'voter_name': matched_voter['full_name']})
            
        return jsonify({'status': 'fail', 'message': 'Biometric Unrecognized: Face does not match any registered voter!'})
    except Exception as e:
        return jsonify({'status': 'fail', 'message': f"Biometric error: {e}"})

@app.route('/ballot')
def ballot():
    state = get_election_state()
    if state['status'] != 'ACTIVE':
        return redirect('/')
    if not session.get('verified_voter_id'):
        return redirect('/booth')
        
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    cur.execute("SELECT id, name, party_name, logo_path FROM candidates WHERE approved = TRUE ORDER BY (UPPER(name) = 'NOTA') ASC, id ASC")
    cands = cur.fetchall()
    conn.close()
    
    return render_template('ballot.html', state=state, candidates=cands, voter_name=session.get('verified_voter_name'))

@app.route('/cast_vote', methods=['POST'])
@app.route('/cast_vote/<int:c_id>', methods=['POST'])
def cast_vote(c_id=None):
    state = get_election_state()
    if state['status'] != 'ACTIVE':
        return jsonify({'status': 'fail', 'message': 'Voting is closed!'}), 400
        
    voter_id = session.get('verified_voter_id')
    if not voter_id:
        return redirect('/booth')
        
    if c_id is None:
        c_id = request.form.get('candidate_id')
        
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    cur.execute("SELECT name FROM candidates WHERE id = %s AND approved = TRUE", (c_id,))
    cand = cur.fetchone()
    if not cand:
        conn.close()
        return "Candidate not found or not approved", 400
        
    cand_name = cand['name']
    
    cur.execute("UPDATE candidates SET votes = COALESCE(votes, 0) + 1 WHERE id = %s", (c_id,))
    cur.execute("UPDATE voters SET has_voted = TRUE, candidate_chosen = %s, voted_at = %s WHERE id = %s",
                (cand_name, datetime.now(), voter_id))
    conn.commit()
    conn.close()
    
    session.pop('verified_voter_id', None)
    session.pop('verified_voter_name', None)
    
    return redirect('/vote_success')

@app.route('/vote_success')
def vote_success():
    return render_template('vote_success.html')

@app.route('/results')
def results():
    state = get_election_state()
    
    if state['status'] != 'CLOSED':
        return render_template('results_locked.html', state=state)
        
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    cur.execute("SELECT name, party_name, logo_path, COALESCE(votes, 0) AS votes, COALESCE(tie_votes, 0) AS tie_votes, has_tie_voted FROM candidates WHERE approved = TRUE ORDER BY votes DESC")
    cands = cur.fetchall()
    
    total_votes = sum(c['votes'] for c in cands) if cands else 0
    actual_candidates = [c for c in cands if c['name'].strip().upper() != 'NOTA']
    
    winner = None
    tie = False
    tied_candidates = []
    pending_count = 0
    
    if actual_candidates:
        max_votes = max(c['votes'] for c in actual_candidates)
        if max_votes > 0:
            tied_candidates = [c for c in actual_candidates if c['votes'] == max_votes]
            if len(tied_candidates) > 1:
                # Check if tie-breaker voting is still active (some candidates haven't voted yet)
                pending_voters = [c for c in actual_candidates if not c['has_tie_voted']]
                pending_count = len(pending_voters)
                if pending_count > 0:
                    tie = True
                else:
                    # Tie-breaker complete! Determine winner by highest votes + tie_votes
                    actual_candidates_sorted = sorted(actual_candidates, key=lambda x: (x['votes'] + x['tie_votes']), reverse=True)
                    # Check if there is still a tie after adding tie-breaker votes
                    top_score = actual_candidates_sorted[0]['votes'] + actual_candidates_sorted[0]['tie_votes']
                    top_scorers = [c for c in actual_candidates_sorted if (c['votes'] + c['tie_votes']) == top_score]
                    if len(top_scorers) > 1:
                        # Still a tie!
                        tie = True
                        tied_candidates = top_scorers
                    else:
                        winner = actual_candidates_sorted[0]
                        
    conn.close()
    return render_template('results.py', state=state, results=cands, winner=winner, tie=tie, tied_candidates=tied_candidates, pending_count=pending_count, total_votes=total_votes)

@app.route('/export_results')
def export_results():
    state = get_election_state()
    if state['status'] != 'CLOSED':
        return redirect('/')
        
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    cur.execute("SELECT name, party_name, COALESCE(votes, 0) AS votes FROM candidates WHERE approved = TRUE ORDER BY votes DESC")
    cands = cur.fetchall()
    conn.close()
    
    output = "Candidate Name,Party Name,Votes\n"
    for row in cands:
        output += f'"{row["name"]}","{row["party_name"]}",{row["votes"]}\n'
        
    response = make_response(output)
    response.headers["Content-Disposition"] = "attachment; filename=Official_Election_Results.csv"
    response.headers["Content-type"] = "text/csv"
    return response

@app.route('/declare_winner')
def declare_winner():
    state = get_election_state()
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    cur.execute("SELECT name, party_name, logo_path, COALESCE(votes, 0) AS votes, COALESCE(tie_votes, 0) AS tie_votes, has_tie_voted FROM candidates WHERE approved = TRUE ORDER BY votes DESC")
    cands = cur.fetchall()
    conn.close()
    
    actual_candidates = [c for c in cands if c['name'].strip().upper() != 'NOTA']
    winner = None
    tie = False
    tied_candidates = []
    
    if actual_candidates:
        max_votes = max(c['votes'] for c in actual_candidates)
        if max_votes > 0:
            tied_candidates = [c for c in actual_candidates if c['votes'] == max_votes]
            if len(tied_candidates) > 1:
                pending_voters = [c for c in actual_candidates if not c['has_tie_voted']]
                if len(pending_voters) > 0:
                    tie = True
                else:
                    actual_candidates_sorted = sorted(actual_candidates, key=lambda x: (x['votes'] + x['tie_votes']), reverse=True)
                    top_score = actual_candidates_sorted[0]['votes'] + actual_candidates_sorted[0]['tie_votes']
                    top_scorers = [c for c in actual_candidates_sorted if (c['votes'] + c['tie_votes']) == top_score]
                    if len(top_scorers) > 1:
                        tie = True
                        tied_candidates = top_scorers
                    else:
                        winner = actual_candidates_sorted[0]

    today = datetime.now().strftime("%B %d, %Y")
    if tie:
        return render_template('certificate.html', tie=True, tied_candidates=tied_candidates, date=today)
    if not winner:
        return render_template('certificate.html', no_winner=True, date=today)
        
    return render_template('certificate.html', no_winner=False, name=winner['name'], party=winner['party_name'], logo_path=winner['logo_path'], votes=(winner['votes'] + winner['tie_votes']), date=today)

if __name__ == '__main__':
    app.run(debug=True)