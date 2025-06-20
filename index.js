const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { OpenAI } = require('openai');
const cors = require('cors');
require('dotenv').config();

const app = express();
const upload = multer();
const PORT = 3000;

// IMPORTANT: Set to true to use mock data and avoid API charges
// This should override any cached or previously set values
const MOCK_MODE = process.env.MOCK_MODE === 'true';

const OPENAI_KEY = process.env.OPENAI_KEY;
// Use a fake API key in mock mode to prevent accidental API calls
const openai = new OpenAI({ apiKey: MOCK_MODE ? 'mock-key-to-prevent-charges' : OPENAI_KEY });

const ADV_MODEL = process.env.ADV_MODEL || 'gpt-3.5-turbo';

// Debug: Print mode at startup
console.log('🔧 APPLICATION MODE:', MOCK_MODE ? 'MOCK' : 'LIVE');
console.log('🔑 OpenAI API Key configured:', OPENAI_KEY ? 'YES' : 'NO');

app.use(cors());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.post('/analyze-resume', upload.single('resume'), async (req, res) => {
  console.log(`🔍 MOCK_MODE value at runtime is:`, MOCK_MODE);

  // ✅ MOCK_MODE first — do NOT touch req.file if MOCK_MODE is true:
  if (MOCK_MODE) {
    console.log('📌 Using MOCK data for resume analysis');
    return res.json({
      message: '✅ Resume parsed and categorized',
      categorizedSkills: {
        Languages: ['JavaScript', 'Python'],
        Frameworks: ['React', 'Node.js'],
        Tools: ['Git'],
        Cloud: ['AWS'],
        Design: ['Figma'],
        'Soft Skills': ['Communication'],
        Other: ['Agile']
      },
      feedback: `Your resume is solid but could benefit from more metrics in experience.

For technical resumes:
- Quantify your impact (e.g., "reduced load time by 30%")
- Add links to projects or GitHub
- Clarify frameworks/tools per project

For non-technical resumes:
- Expand on leadership or teamwork experience
- Emphasize communication and initiative`,
      projectIdeas: `Project 1: Build a resume parser web app using Node.js and OpenAI APIs.\n\nProject 2: Create a personal portfolio that auto-updates using GitHub activity.`,
      skillStrength: {
        Languages: 2,
        Frameworks: 2,
        Tools: 1,
        Cloud: 1,
        Design: 1,
        'Soft Skills': 1,
        Other: 1
      }
    });
  }

  // ✅ Now check file AFTER mock check
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No resume file uploaded' });

  // 🚀 LIVE mode:
  try {
    console.log('🚀 Using LIVE mode for resume analysis');
    const parsed = await pdfParse(file.buffer);
    const resumeText = parsed.text;

    const skillsPrompt = `
Extract and categorize skills from this resume text:

${resumeText}

Return a JSON object with these categories:
- Languages (programming languages)
- Frameworks (software frameworks and libraries)
- Tools (software tools, IDEs, etc.)
- Cloud (cloud platforms and services)
- Design (design tools and methodologies)
- Soft Skills (communication, teamwork, etc.)
- Other (any other skills that don't fit above)

For each category, provide an array of skills. If a category has no skills, return an empty array.
Return ONLY valid JSON without any explanation or markdown.
    `.trim();

    const gptSkills = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: skillsPrompt }],
      temperature: 0.3
    });

    let categorizedSkills = {};
    try {
      categorizedSkills = JSON.parse(gptSkills.choices[0]?.message?.content || '{}');
    } catch (err) {
      console.error('Error parsing skills JSON:', err);
      categorizedSkills = {
        Languages: [],
        Frameworks: [],
        Tools: [],
        Cloud: [],
        Design: [],
        'Soft Skills': [],
        Other: []
      };
    }

    const skillStrength = {};
    Object.keys(categorizedSkills).forEach(category => {
      const count = categorizedSkills[category].length;
      skillStrength[category] = count > 3 ? 3 : count;
    });

    const feedbackPrompt = `
You're a professional resume reviewer helping applicants from ALL industries.
A user has uploaded the following resume text:

${resumeText}

Give 3–4 specific and encouraging suggestions for what they should improve.
Include comments about how their skills are presented, any missing skills you notice, and general resume improvements.
Adapt advice to both tech and non-tech resumes.
Create a line of space between tech-related and non-tech-related advice.
Output plain text only.
    `.trim();

    const gptFeedback = await openai.chat.completions.create({
      model: ADV_MODEL,
      messages: [{ role: 'user', content: feedbackPrompt }],
      temperature: 0.5
    });

    const feedback = gptFeedback.choices[0]?.message?.content || 'No suggestions generated.';

    const projectPrompt = `
"""
${resumeText}
"""
Suggest 2 resume-worthy projects they can build to strengthen their profile in their field.
Be practical and impactful.
Return plain text only.
    `.trim();

    const gptProjects = await openai.chat.completions.create({
      model: ADV_MODEL,
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

  console.log('🔍 ATS scan request received. Mode:', MOCK_MODE ? 'MOCK' : 'LIVE');

  if (MOCK_MODE) {
    console.log('📌 Using MOCK data for ATS scan');
    const mockResumeHTML = `
<h1>Ali Kayani</h1>
... etc (same as your current MOCK block) ...
`;

    return res.json({
      atsEvaluation: {
        inferredField: 'Software Engineering',
        atsScore: 82,
        recruiterEngagementLikelihood: 'High – clear metrics and strong stack',
        estimatedRecruiterReadTimeSeconds: 35,
        toneAnalysis: 'Confident',
        pros: ['Uses metrics', 'Clear tech stack'],
        cons: ['Some passive voice'],
        redFlags: ['Minor employment gap'],
        missingKeywords: ['Docker', 'Kubernetes'],
        suggestedImprovements: ['Add cloud metrics', 'Quantify project impact'],
        fieldSpecificTips: ['Highlight CI/CD experience'],
        psychologicalInsights: ['Shows growth mindset'],
        formattingTips: ['Ensure consistent bullet alignment']
      },
      originalResumeHTML: mockResumeHTML,
      plainTextResume: 'Mock resume text here'
    });
  }

  // LIVE mode:
  try {
    console.log('🚀 Using LIVE mode for ATS scan');
    const parsed = await pdfParse(file.buffer);
    const resumeText = parsed.text;

    const atsPrompt = `
You are the most advanced Applicant Tracking System (ATS) simulator and recruiter advisor on the planet.

Your task is to analyze the following resume and provide an **exhaustive professional evaluation** that goes far beyond standard ATS feedback. DO NOT include or repeat name, contact info, skills, certifications, or experience entries already visible in the resume. Your goal is to provide hidden, high-level insights that both ATS software and experienced human recruiters would use to evaluate this resume.

You must also:
- Infer the most likely career field or job target based on resume content.
- Tailor all advice to that career path.
- Identify subtle weaknesses even if the resume seems strong.
- Avoid generic fluff — prioritize actionable, field-specific, high-ROI feedback.
- Suggest improvements to tone, narrative voice, and keyword density.
- Flag any subconscious negative impressions that might arise.
- Incorporate behavioral psychology or recruiter heuristics where possible.
- Mention layout or formatting blockers that could hinder parsing.
- Point out stylistic choices that might affect perceptions (e.g., sentence complexity, passive voice, overused buzzwords).
- Deliver feedback that will help the user **stand out from the top 5% of resumes** in their target field.

Return your output as clean, valid JSON in the following format:

{
  "inferredField": "",
  "atsScore": 0,
  "recruiterEngagementLikelihood": "",
  "estimatedRecruiterReadTimeSeconds": 0,
  "toneAnalysis": "",
  "pros": [],
  "cons": [],
  "redFlags": [],
  "missingKeywords": [],
  "suggestedImprovements": [],
  "fieldSpecificTips": [],
  "psychologicalInsights": [],
  "formattingTips": []
}

Here is the resume to analyze:
"""
${resumeText}
"""
    `.trim();

    const atsResponse = await openai.chat.completions.create({
      model: ADV_MODEL,
      messages: [{ role: 'user', content: atsPrompt }],
      temperature: 0.2
    });

    let atsEvaluation = {};
    try {
      atsEvaluation = JSON.parse(atsResponse.choices[0]?.message?.content || '{}');
    } catch {
      atsEvaluation = {};
    }

    const htmlPrompt = `
Convert this resume text to clean, formatted HTML:

"""
${resumeText}
"""

Use this structure:
- h1 for name
- div with class "contact-info" for contact details
- h2 for section headers (EXPERIENCE, EDUCATION, SKILLS, etc.)
- div with class "section" for each job/education entry
- p with class "job-title" for job titles or degrees
- div with class "job-details" containing spans for company/school and dates
- ul/li for bullet points

Return ONLY the HTML with no explanation or markdown.
    `.trim();

    const htmlResponse = await openai.chat.completions.create({
      model: ADV_MODEL,
      messages: [{ role: 'user', content: htmlPrompt }],
      temperature: 0.2
    });

    const originalResumeHTML = htmlResponse.choices[0]?.message?.content || '';

    res.json({
      atsEvaluation,
      originalResumeHTML,
      plainTextResume: resumeText
    });
  } catch (err) {
    console.error('ATS Error:', err.response?.data || err.message);
    res.status(500).json({ error: '❌ Failed to retrieve ATS summary.' });
  }
});


// Chat endpoint for resume assistance with conversation history
app.post('/chat', express.json(), async (req, res) => {
  console.log(`🔍 MOCK_MODE value at runtime is:`, MOCK_MODE);

  const { message, resumeText, conversationHistory = [] } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'No message provided' });
  }

  console.log('💬 Chat request received. Mode:', MOCK_MODE ? 'MOCK' : 'LIVE');

  if (MOCK_MODE) {
    console.log('📌 Using MOCK data for chat response');
    let mockReply = '';

    if (message.toLowerCase().includes('experience') || message.toLowerCase().includes('work')) {
      mockReply = "Looking at your experience section, I notice you could add more quantifiable achievements...";
    } else if (message.toLowerCase().includes('education')) {
      mockReply = "Your education section looks good...";
    } else if (message.toLowerCase().includes('skills')) {
      mockReply = "For your skills section, I recommend organizing them...";
    } else if (message.toLowerCase().includes('format') || message.toLowerCase().includes('layout')) {
      mockReply = "For resume formatting, I recommend using a clean, professional layout...";
    } else if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi')) {
      mockReply = "Hello! I'm your AI resume assistant...";
    } else {
      mockReply = "I've analyzed your resume and have some suggestions...";
    }

    const updatedHistory = [
      ...(conversationHistory || []),
      { role: 'user', content: message },
      { role: 'assistant', content: mockReply }
    ];

    // IMPORTANT → MUST RETURN so LIVE does not run:
    return res.json({
      reply: mockReply,
      conversationHistory: updatedHistory
    });
  }

  // LIVE mode → only runs if MOCK_MODE is false
  try {
    console.log('🚀 Using LIVE mode for chat response');
    let messages = [
      {
        role: 'system',
        content: `You are an AI assistant specialized in resume writing and career advice for ALL fields...`
      }
    ];

    if (conversationHistory.length > 0) {
      messages = [...messages, ...conversationHistory];
    }

    if (resumeText && messages.length === 1) {
      messages.push({
        role: 'user',
        content: `Here is my resume:\n"""\n${resumeText}\n"""\n\n${message}`
      });
    } else {
      messages.push({
        role: 'user',
        content: message
      });
    }

    const chatResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
      temperature: 0.7
    });

    const reply = chatResponse.choices[0]?.message?.content || 'I apologize, but I was unable to process your request.';

    res.json({
      reply,
      conversationHistory: [
        ...messages.slice(1),
        { role: 'assistant', content: reply }
      ]
    });
  } catch (err) {
    console.error('Chat Error:', err.response?.data || err.message);
    res.status(500).json({ error: '❌ Failed to process chat message.' });
  }
});

// Compare resume to job description
app.post('/compare-jd', express.json(), async (req, res) => {
  const { resumeText, jobDescription } = req.body;
  if (!resumeText || !jobDescription) {
    return res.status(400).json({ error: 'Both resumeText and jobDescription are required' });
  }

  // Mock mode quick response
  if (MOCK_MODE) {
    return res.json({
      matchedSkills: ['JavaScript', 'React'],
      missingSkills: ['Docker', 'AWS'],
      overallMatch: '65%'
    });
  }

  try {
    const prompt = `Compare the following resume with the job description.

RESUME:
"""
${resumeText}
"""

JOB DESCRIPTION:
"""
${jobDescription}
"""

1. List up to 10 skills/keywords that appear in BOTH, label as Matched.
2. List up to 10 important skills from JD that are MISSING in resume, label as Missing.
3. Give an overall match percentage (rough estimate).
Return JSON with keys matchedSkills, missingSkills, overallMatch.`;

    const resp = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    });

    let data = {};
    try { data = JSON.parse(resp.choices[0]?.message?.content || '{}'); }
    catch { data = { error: 'Failed to parse compare response' }; }

    res.json(data);
  } catch(err) {
    console.error('Compare JD Error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to compare job description.' });
  }
});

app.listen(PORT, () =>
  console.log(`✅ Resume Analyzer running at http://localhost:${PORT} in ${MOCK_MODE ? 'MOCK' : 'LIVE'} mode`)
);
