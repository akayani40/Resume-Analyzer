const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { OpenAI } = require('openai');
const app = express();
const upload = multer();
require('dotenv').config();
const PORT = 3000;

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const OPENAI_KEY = process.env.OPENAI_KEY; 
const openai = new OpenAI({ apiKey: OPENAI_KEY });

const MOCK_MODE = false;

app.post('/analyze-resume', upload.single('resume'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No resume file uploaded' });

  try {
    let rawSkills = [];

    if (MOCK_MODE) {
      rawSkills = ['JavaScript', 'React', 'Node.js', 'Git', 'AWS', 'Teamwork', 'Public Speaking'];
    } else {
      const parsed = await pdfParse(file.buffer);
      const resumeText = parsed.text;

      const skillExtractPrompt = `
You're an AI assistant. A user has uploaded a resume. Extract the most relevant skills (hard and soft) mentioned in this text. Return them in a JSON array of strings. Only output JSON.

Resume:
"""${resumeText}"""
      `.trim();

      const skillResponse = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: skillExtractPrompt }],
        temperature: 0.2
      });

      try {
        rawSkills = JSON.parse(skillResponse.choices[0].message.content || '[]');
      } catch {
        rawSkills = [];
      }
    }

    if (rawSkills.length === 0) {
      return res.json({ message: 'No skills found in resume.', categorizedSkills: {} });
    }

    const categorizePrompt = `
You are an AI assistant that categorizes resume skills into organized JSON format.
Group them into: Languages, Frameworks, Tools, Cloud, Design, Soft Skills, Other.
Return only JSON:
{
  "Languages": [...],
  "Frameworks": [...],
  "Tools": [...],
  "Cloud": [...],
  "Design": [...],
  "Soft Skills": [...],
  "Other": [...]
}
Skills to categorize:
${JSON.stringify(rawSkills)}
    `.trim();

    const gptCategorize = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: categorizePrompt }],
      temperature: 0.2
    });

    const jsonText = gptCategorize.choices[0]?.message?.content || '{}';
    let categorizedSkills = {};
    try {
      categorizedSkills = JSON.parse(jsonText);
    } catch {
      return res.status(500).json({ error: '❌ Failed to parse skill categories.' });
    }

    const skillStrength = {};
    for (const [category, skills] of Object.entries(categorizedSkills)) {
      skillStrength[category] = skills.length;
    }

    const feedbackPrompt = `
You're a recruiter for either a FANG company or just a serious harsh recruiter for any type of Tech company. A user has uploaded a resume with these categorized skills:
${JSON.stringify(categorizedSkills, null, 2)}
Give 3–4 specific and encouraging suggestions for what they should improve. Adapt advice to both tech and non-tech resumes.
Create a line of space in between the sections of tech related and non tech related.
    `.trim();

    const gptFeedback = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: feedbackPrompt }],
      temperature: 0.5
    });

    const feedback = gptFeedback.choices[0]?.message?.content || 'No suggestions generated.';

    const projectPrompt = `
You're an AI suggesting strong portfolio projects. Based on this skill breakdown:
${JSON.stringify(categorizedSkills, null, 2)}
Suggest 2 resume-worthy projects they can build to cover weak or missing categories. Be practical and impactful.
Be kind but straightforward and helpful.
Return plain text only.
    `.trim();

    const gptProjects = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: projectPrompt }],
      temperature: 0.6
    });

    const projectIdeas = gptProjects.choices[0]?.message?.content || 'No projects suggested.';

    res.json({
      message: '✅ Resume parsed and categorized',
      categorizedSkills,
      feedback,
      projectIdeas,
      skillStrength
    });

  } catch (err) {
    console.error('GPT Error:', err.response?.data || err.message);
    res.status(500).json({ error: '❌ Failed to parse resume or generate recommendations.' });
  }
});

app.post('/ats-scan', upload.single('resume'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No resume uploaded' });

  try {
    let atsSummary;

    if (MOCK_MODE) {
      atsSummary = {
        name: 'Ali Kayani',
        email: 'ali.kayani@example.com',
        phone: '(555) 123-4567',
        education: [
          { organization: 'UC Irvine', degree: 'B.S. Informatics', dates: '2020 - 2024' }
        ],
        experience: [
          { title: 'Product Intern', company: 'Kiick on Fire', dates: 'Summer 2023', location: 'Remote' },
          { title: 'QA Tester', company: 'NASA Internship', dates: 'Fall 2022', location: 'CA' }
        ]
      };
    } else {
      const parsed = await pdfParse(file.buffer);
      const resumeText = parsed.text;

      const atsPrompt = `
You're an ATS scanner. Extract the following from this resume text:

- Full name
- Email
- Phone number
- Education history (school, degree, dates)
- Work experience (title, company, dates, location)

Return this in clean JSON format:
{
  "name": "",
  "email": "",
  "phone": "",
  "education": [ { "organization": "", "degree": "", "dates": "" } ],
  "experience": [ { "title": "", "company": "", "dates": "", "location": "" } ]
}

Resume:
"""
${resumeText}
"""
      `.trim();

      const atsResponse = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: atsPrompt }],
        temperature: 0.2
      });

      try {
        atsSummary = JSON.parse(atsResponse.choices[0]?.message?.content || '{}');
      } catch {
        atsSummary = {};
      }
    }

    res.json({ atsSummary });

  } catch (err) {
    console.error('ATS Error:', err.response?.data || err.message);
    res.status(500).json({ error: '❌ Failed to retrieve ATS summary.' });
  }
});

app.listen(PORT, () =>
  console.log(`✅ Resume Analyzer running at http://localhost:${PORT} in ${MOCK_MODE ? 'MOCK' : 'LIVE'} mode`)
);
