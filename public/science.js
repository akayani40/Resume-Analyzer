const useMockData = true; // Set to false for live API

document.getElementById('resumeForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const file = document.getElementById('resumeInput').files[0];

  if (!file && !useMockData) {
    document.getElementById('result').innerHTML = '❌ Please upload a resume file.';
    return;
  }

  const formData = new FormData();
  formData.append('resume', file);

  document.getElementById('result').innerHTML = '⏳ Analyzing...';
  document.getElementById('atsView').innerHTML = '';
  document.getElementById('controls').style.display = 'none';

  if (useMockData) {
    setTimeout(() => {
      const mockData = {
        categorizedSkills: {
          "Scientific Research": ["Microscopy", "Cell Culture", "Spectroscopy"],
          "Programming & Analysis": ["Python", "MATLAB", "R"],
          "Lab Tools & Instruments": ["PCR", "Centrifuge", "Titration Equipment"],
          "Data Management": ["Excel", "SPSS", "GraphPad Prism"],
          "Communication & Writing": ["Scientific Writing", "Grant Writing", "Public Speaking"],
          "Soft Skills": ["Critical Thinking", "Attention to Detail"]
        },
        feedback: "Consider improving your proficiency in R for data analysis and seek out publication experience.\n\nImprove your collaborative research examples and communication clarity in your experience section.",
        projectIdeas: "1. Analyze gene expression data from a public dataset.\n2. Design an experiment to test a novel hypothesis using CRISPR tools.",
        skillStrength: {
          "Scientific Research": 7,
          "Programming & Analysis": 6,
          "Lab Tools & Instruments": 5,
          "Data Management": 6,
          "Communication & Writing": 4,
          "Soft Skills": 8
        },
        atsSummary: {
          name: "Avery Lee",
          email: "avery.lee@example.com",
          phone: "(555) 987-6543",
          experience: [
            { title: "Research Assistant", company: "BioTech Labs", dates: "2022–2023", location: "San Diego, CA" }
          ],
          education: [
            { degree: "B.S. in Biology", organization: "UC Irvine", dates: "2020–2024" }
          ]
        }
      };
      renderResults(mockData);
    }, 1000);
  } else {
    try {
      const res = await fetch('/analyze-resume', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      renderResults(data);
    } catch (err) {
      console.error(err);
      document.getElementById('result').innerHTML = '❌ An unexpected error occurred.';
    }
  }
});

function renderResults(data) {
  const categoryIcons = {
    "Scientific Research": "🔬",
    "Programming & Analysis": "💻",
    "Lab Tools & Instruments": "⚗️",
    "Data Management": "📊",
    "Communication & Writing": "📝",
    "Soft Skills": "🧠"
  };

  let html = `<h3>✅ Resume Parsed & Categorized</h3>`;
  for (const [category, skills] of Object.entries(data.categorizedSkills || {})) {
    const icon = categoryIcons[category] || '';
    html += `<div class="category"><h4>${icon} ${category}</h4>`;
    html += skills.length
      ? `<p>${skills.join(', ')}</p>`
      : `<p class="empty">No skills found in this category.</p>`;
    html += `</div>`;
  }

  if (data.feedback) {
    const feedback = data.feedback.split(/\n+/);
    html += `<div style="margin-top: 30px;"><h4>📌 Smart Feedback</h4>`;
    html += feedback.map(f => `<p>${f}</p>`).join('');
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
