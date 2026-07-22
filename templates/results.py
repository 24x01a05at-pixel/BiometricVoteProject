<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Official Certified Results</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
    <style>
        body { background: #f8fafc; font-family: 'Segoe UI', system-ui, sans-serif; }
        .winner-card { background: linear-gradient(135deg, #1e3a8a 0%, #1e1b4b 100%); color: white; border-radius: 20px; box-shadow: 0 10px 30px rgba(30, 58, 138, 0.3); }
        .tie-card { background: linear-gradient(135deg, #b45309 0%, #78350f 100%); color: white; border-radius: 20px; box-shadow: 0 10px 30px rgba(180, 83, 9, 0.3); }
        .no-winner-card { background: linear-gradient(135deg, #475569 0%, #1e293b 100%); color: white; border-radius: 20px; }
        .card-custom { border: none; border-radius: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.06); }
        .winner-logo-box { width: 110px; height: 110px; border-radius: 50%; object-fit: cover; border: 4px solid #f59e0b; background: white; margin: 0 auto 1.5rem; }
        .tie-logo-box { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 3px solid #f59e0b; background: white; margin: 0 0.5rem 1rem; }
    </style>
</head>
<body>

    <nav class="navbar navbar-expand-lg navbar-dark bg-dark py-3">
        <div class="container">
            <a class="navbar-brand fw-bold" href="/"><i class="bi bi-award-fill text-warning me-2"></i>Official Election Results</a>
            <div>
                <a href="/" class="btn btn-outline-light btn-sm me-2"><i class="bi bi-house me-1"></i>Home Portal</a>
                <a href="/export_results" class="btn btn-success btn-sm me-2"><i class="bi bi-download me-1"></i>CSV Report</a>
                <a href="/declare_winner" class="btn btn-warning btn-sm fw-bold"><i class="bi bi-trophy-fill me-1"></i>Certificate</a>
            </div>
        </div>
    </nav>

    <div class="container py-5">
        
        <!-- Winner or Tie Highlight Card -->
        {% if tie %}
        <div class="card tie-card p-4 p-md-5 text-center mb-5">
            <div class="d-flex justify-content-center flex-wrap mb-3">
                {% for tc in tied_candidates %}
                    {% if tc.logo_path %}
                        <img src="{{ tc.logo_path }}" class="tie-logo-box" alt="Tied Candidate Logo" title="{{ tc.name }}">
                    {% else %}
                        <div class="tie-logo-box d-flex align-items-center justify-content-center text-muted fs-4 fw-bold bg-light"><i class="bi bi-person"></i></div>
                    {% endif %}
                {% endfor %}
            </div>
            <h5 class="text-uppercase text-warning fw-bold letter-spacing-2"><i class="bi bi-exclamation-triangle-fill me-1"></i>Election Tie Declared</h5>
            <h2 class="fw-bold mb-3">
                {% for tc in tied_candidates %}
                    {{ tc.name }}{% if not loop.last %} & {% endif %}
                {% endfor %}
            </h2>
            <p class="fs-5 opacity-90 mx-auto" style="max-width: 700px;">
                <strong>Tie Election</strong>: Two or more candidates received the same number of votes ({{ tied_candidates[0].votes }} votes each). Candidates will vote again to resolve, or the Admin will decide the leader or reconduct the election.
            </p>
        </div>
        {% elif winner and winner.votes > 0 %}
        <div class="card winner-card p-4 p-md-5 text-center mb-5">
            {% if winner.logo_path %}
                <img src="{{ winner.logo_path }}" class="winner-logo-box" alt="Winner Logo">
            {% else %}
                <div class="mb-3 text-warning">
                    <i class="bi bi-trophy-fill display-2"></i>
                </div>
            {% endif %}
            <h5 class="text-uppercase text-warning fw-bold letter-spacing-2">Declared Winner</h5>
            <h1 class="display-4 fw-extrabold mb-2">{{ winner.name }}</h1>
            <p class="fs-4 text-light opacity-75 mb-3">{{ winner.party_name }}</p>
            <div class="d-inline-block bg-white text-dark fw-bold fs-5 px-4 py-2 rounded-pill">
                {{ winner.votes }} Certified Votes
            </div>
        </div>
        {% else %}
        <div class="card no-winner-card p-4 p-md-5 text-center mb-5">
            <div class="mb-3 text-secondary">
                <i class="bi bi-info-circle display-2"></i>
            </div>
            <h2 class="fw-bold mb-2">No Winner Declared</h2>
            <p class="lead text-light opacity-75 mb-0">No votes were cast during this election cycle (0 Total Votes Recorded).</p>
        </div>
        {% endif %}

        <!-- Results Breakdown Table -->
        <div class="card card-custom p-4 p-md-5 bg-white">
            <h3 class="fw-bold mb-4 text-dark"><i class="bi bi-bar-chart-fill text-primary me-2"></i>Final Vote Tally</h3>
            <div class="table-responsive">
                <table class="table table-hover align-middle fs-5">
                    <thead class="table-dark">
                        <tr>
                            <th>Rank</th>
                            <th>Candidate Name</th>
                            <th>Party Name</th>
                            <th class="text-end">Total Votes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {% for r in results %}
                        <tr>
                            <td class="fw-bold">#{{ loop.index }}</td>
                            <td class="fw-bold text-dark">{{ r.name }}</td>
                            <td><span class="badge bg-secondary fs-6">{{ r.party_name }}</span></td>
                            <td class="text-end fw-extrabold text-primary">{{ r.votes }} Votes</td>
                        </tr>
                        {% else %}
                        <tr><td colspan="4" class="text-center text-muted">No candidates listed.</td></tr>
                        {% endfor %}
                    </tbody>
                </table>
            </div>
        </div>

    </div>

</body>
</html>