const useMockData = true; // Toggle to false to use live API

// Dark mode + file label setup
window.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('modeToggle');
  toggle.checked = localStorage.getItem('theme') === 'dark';
  toggle.addEventListener('change', () => {
    const theme = toggle.checked ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  });

  const fileInput = document.getElementById('resumeInput');
  const fileNameSpan = document.getElementById('fileName');
  fileInput.addEventListener('change', () => {
    fileNameSpan.textContent = fileInput.files[0]?.name || "Select Your Resume";
  });
});

// Tab view switch
function toggleView(viewId) {
  document.getElementById('result').style.display = viewId === 'result' ? 'block' : 'none';
  document.getElementById('atsView').style.display = viewId === 'atsView' ? 'block' : 'none';
}

// Form submit
document.getElementById('resumeForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const file = document.getElementById('resumeInput').files[0];
  if (!file && !useMockData) {
    document.getElementById('result').innerHTML = '❌ Please upload a resume file.';
    return;
  }

  const formData = new FormData();
  if (file) formData.append('resume', file);

  document.getElementById('result').innerHTML = '⏳ Analyzing...';
  document.getElementById('atsView').innerHTML = '';
  document.getElementById('controls').style.display = 'none';

  if (useMockData) {
    setTimeout(() => {
      renderResults(getMockData());
    }, 1000);
  } else {
    try {
      const res = await fetch('/analyze-resume', { method: 'POST', body: formData });
      const data = await res.json();
      renderResults(data);
    } catch (err) {
      console.error(err);
      document.getElementById('result').innerHTML = '❌ An unexpected error occurred.';
    }
  }
});

// Results render
function renderResults(data) {
  const categoryIcons = {
    "Finance & Accounting": "💰",
    "Marketing & Sales": "📈",
    "Data Analysis": "📊",
    "Operations & Strategy": "⚙️",
    "Leadership & Communication": "🗣️",
    "Business Tools": "🧰",
    "Soft Skills": "🤝"
  };

  let html = `<h3>✅ Resume Parsed & Categorized</h3>`;
  for (const [cat, skills] of Object.entries(data.categorizedSkills || {})) {
    html += `<div class="category"><h4>${categoryIcons[cat] || ''} ${cat}</h4>`;
    html += skills.length ? `<p>${skills.join(', ')}</p>` : `<p class="empty">No skills found.</p>`;
    html += `</div>`;
  }

  if (data.feedback) {
    html += `<div style="margin-top: 30px;"><h4>📌 Smart Feedback</h4>`;
    html += data.feedback.split(/\n+/).map(f => `<p>${f}</p>`).join('');
    html += `</div>`;
  }

  if (data.projectIdeas) {
    const ideas = data.projectIdeas.split(/\n\s*\d+[\.\)]\s*/g).map(p => p.trim()).filter(Boolean);
    if (ideas.length) {
      html += `<div style="margin-top: 20px;"><h4>🚀 Project Recommendations</h4>`;
      html += ideas.map(p => `<p>${p}</p>`).join('');
      html += `</div>`;
    }
  }

  if (data.skillStrength) {
    html += `<div style="margin-top: 30px;"><h4>📊 Skill Heatmap</h4><canvas id="skillChart" width="400" height="300"></canvas></div>`;
  }

  document.getElementById('result').innerHTML = html;
  document.getElementById('controls').style.display = 'flex';

  if (data.skillStrength) {
    const ctx = document.getElementById('skillChart').getContext('2d');
    new Chart(ctx, {
      type: 'radar',
      data: {
        labels: Object.keys(data.skillStrength),
        datasets: [{
          label: 'Skill Strength',
          data: Object.values(data.skillStrength),
          fill: true,
          backgroundColor: 'rgba(0, 122, 255, 0.2)',
          borderColor: 'rgba(0, 122, 255, 1)',
          pointBackgroundColor: 'rgba(0, 122, 255, 1)'
        }]
      },
      options: {
        responsive: true,
        scales: {
          r: {
            suggestedMin: 0,
            suggestedMax: 10,
            ticks: { stepSize: 1 }
          }
        }
      }
    });
  }

  const ats = data.atsSummary || {};
  let atsHTML = `<h3>📄 ATS Summary View</h3>`;
  atsHTML += `<p><strong>Name:</strong> ${ats.name || '-'}</p>`;
  atsHTML += `<p><strong>Email:</strong> ${ats.email || '-'}</p>`;
  atsHTML += `<p><strong>Phone:</strong> ${ats.phone || '-'}</p>`;

  if (ats.experience?.length) {
    atsHTML += `<h4>Experience:</h4><ul>`;
    ats.experience.forEach(exp => {
      atsHTML += `<li><strong>${exp.title}</strong> at ${exp.company} (${exp.dates})${exp.location ? ' – ' + exp.location : ''}</li>`;
    });
    atsHTML += `</ul>`;
  }

  if (ats.education?.length) {
    atsHTML += `<h4>Education:</h4><ul>`;
    ats.education.forEach(ed => {
      atsHTML += `<li>${ed.degree} at ${ed.organization} ${ed.dates ? `(${ed.dates})` : ''}</li>`;
    });
    atsHTML += `</ul>`;
  }

  document.getElementById('atsView').innerHTML = atsHTML;
}

function getMockData() {
  return {
    categorizedSkills: {
      "Finance & Accounting": ["Financial Modeling", "Budgeting"],
      "Marketing & Sales": ["SEO", "CRM Tools"],
      "Data Analysis": ["Excel", "SQL", "Market Research"],
      "Operations & Strategy": ["Project Management", "Logistics"],
      "Leadership & Communication": ["Public Speaking", "Team Leadership"],
      "Business Tools": ["Salesforce", "Microsoft Office"],
      "Soft Skills": ["Problem Solving", "Adaptability"]
    },
    feedback: "Learn advanced Excel functions and Tableau.\n\nImprove leadership examples in your experience section.",
    projectIdeas: "1. Create a budgeting app.\n2. Run a mock digital marketing campaign for a local business.",
    skillStrength: {
      "Finance & Accounting": 8,
      "Marketing & Sales": 7,
      "Data Analysis": 6,
      "Operations & Strategy": 7,
      "Leadership & Communication": 5,
      "Business Tools": 6,
      "Soft Skills": 8
    },
    atsSummary: {
      name: "Jane Doe",
      email: "jane.doe@example.com",
      phone: "(123) 456-7890",
      experience: [
        { title: "Marketing Intern", company: "Acme Corp", dates: "2023", location: "NYC" }
      ],
      education: [
        { degree: "B.A. in Business Administration", organization: "State University", dates: "2020–2024" }
      ]
    }
  };
}
