const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const { OpenAI } = require('openai');
const app = express();
const upload = multer();
require('dotenv').config();
const PORT = 3000;

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const AFFINDA_KEY = process.env.AFFINDA_KEY;
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
      const form = new FormData();
      form.append('file', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype
      });

      const affindaRes = await axios.post(
        'https://api.affinda.com/v2/resumes',
        form,
        {
          headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${AFFINDA_KEY}`
          }
        }
      );

      rawSkills = affindaRes.data.data.skills?.map(s => s.name).filter(Boolean) || [];
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
      model: 'gpt-3.5-turbo',
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
You're a recruiter for either a FANG company or just a serious harsh recruiter for any type of Tech comapny. A user has uploaded a resume with these categorized skills:
${JSON.stringify(categorizedSkills, null, 2)}
Give 3–4 specific and encouraging suggestions for what they should improve. Adapt advice to both tech and non-tech resumes.
Create a line of space in between the sections of tech related and non tech related.
    `.trim();

    const gptFeedback = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
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
      model: 'gpt-3.5-turbo',
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
      const form = new FormData();
      form.append('file', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype
      });

      const response = await axios.post('https://api.affinda.com/v2/resumes', form, {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${AFFINDA_KEY}`
        }
      });

      const data = response.data.data;
      atsSummary = {
        name: data.name?.text || 'Not found',
        email: data.emails?.[0] || 'Not found',
        phone: data.phoneNumbers?.[0] || 'Not found',
        education: (data.education || []).map(e => ({
          organization: e.organization,
          degree: e.accreditation?.education || e.accreditation?.inputStr || 'Unknown degree',
          dates: [e.dates?.startDate, e.dates?.endDate].filter(Boolean).join(' - ')
        })),
        experience: (data.workExperience || []).map(e => ({
          title: e.jobTitle,
          company: e.organization,
          dates: `${e.dates?.startDate || ''} - ${e.dates?.endDate || ''}`,
          location: e.location?.text || ''
        }))
      };
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
