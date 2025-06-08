const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { OpenAI } = require('openai');
const cors = require('cors');
require('dotenv').config();

const app = express();
const upload = multer();
const PORT = 3000;

const OPENAI_KEY = process.env.OPENAI_KEY;
const openai = new OpenAI({ apiKey: OPENAI_KEY });
const MOCK_MODE = false; 

app.use(cors());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.post('/analyze-resume', upload.single('resume'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No resume file uploaded' });

  if (MOCK_MODE) {
   
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

  // 🔥 GPT-based logic below (this stays the same as before if you want live mode)
  try {
    let rawSkills = [];

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

  if (MOCK_MODE) {
    // Mock resume content for testing
    const mockResumeHTML = `
<h1>Ali Kayani</h1>
<div class="contact-info">ali@alikayani.com</div>

<h2>EXPERIENCE</h2>
<div class="section">
  <p class="job-title">Software Engineer Intern</p>
  <div class="job-details">
    <span>ForOurLastName</span>
    <span>September 2024 - December 2024 – Irvine, CA</span>
  </div>
  <ul>
    <li>Accomplishment or responsibility (edit this)</li>
    <li>Another accomplishment or responsibility (edit this)</li>
  </ul>
</div>

<div class="section">
  <p class="job-title">Lead Computer Hardware Engineer</p>
  <div class="job-details">
    <span>NASA L SPACE</span>
    <span>January 2024 - April 2024 – Remote</span>
  </div>
  <ul>
    <li>Accomplishment or responsibility (edit this)</li>
    <li>Another accomplishment or responsibility (edit this)</li>
  </ul>
</div>

<div class="section">
  <p class="job-title">Project Management Intern</p>
  <div class="job-details">
    <span>All State Restoration</span>
    <span>June 2023 - September 2023 – Brooklyn, NY</span>
  </div>
  <ul>
    <li>Accomplishment or responsibility (edit this)</li>
    <li>Another accomplishment or responsibility (edit this)</li>
  </ul>
</div>

<div class="section">
  <p class="job-title">Vice President</p>
  <div class="job-details">
    <span>Kappa Sigma Fraternity</span>
    <span>January 2023 - January 2024 – Irvine, CA</span>
  </div>
  <ul>
    <li>Accomplishment or responsibility (edit this)</li>
    <li>Another accomplishment or responsibility (edit this)</li>
  </ul>
</div>

<h2>EDUCATION</h2>
<div class="section">
  <p class="job-title">B.S. Informatics, specialization in HCI</p>
  <div class="job-details">
    <span>University of California, Irvine</span>
    <span>Expected Dec 2025</span>
  </div>
</div>

<h2>SKILLS</h2>
<p>JavaScript, React, Node.js, Python, HTML, CSS, Git, UI/UX Design, Project Management</p>
`;

    return res.json({
      atsSummary: {
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
      },
      originalResumeHTML: mockResumeHTML // Return the original resume HTML
    });
  }

  // 🔥 LIVE mode logic (uses OpenAI and PDF parsing)
  try {
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

    let atsSummary = {};
    try {
      atsSummary = JSON.parse(atsResponse.choices[0]?.message?.content || '{}');
    } catch {
      atsSummary = {};
    }

    res.json({ atsSummary });

  } catch (err) {
    console.error('ATS Error:', err.response?.data || err.message);
    res.status(500).json({ error: '❌ Failed to retrieve ATS summary.' });
  }
});

// Chat endpoint for resume assistance with conversation history
app.post('/chat', express.json(), async (req, res) => {
  const { message, resumeText, conversationHistory = [] } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'No message provided' });
  }
  
  if (MOCK_MODE) {
    // More dynamic mock response based on the message content
    let mockReply = '';
    
    if (message.toLowerCase().includes('experience') || message.toLowerCase().includes('work')) {
      mockReply = "Looking at your experience section, I notice you could add more quantifiable achievements. For example, instead of 'Managed a team', try 'Led a team of 5 developers, increasing productivity by 30%'. This helps recruiters understand your impact.";
    } else if (message.toLowerCase().includes('education')) {
      mockReply = "Your education section looks good. Consider adding relevant coursework or academic achievements that align with the jobs you're applying for. This can be especially helpful if you're a recent graduate.";
    } else if (message.toLowerCase().includes('skills')) {
      mockReply = "For your skills section, I recommend organizing them by proficiency level or by category (technical, soft skills, languages, etc.). Also, make sure to include skills mentioned in job descriptions you're interested in.";
    } else if (message.toLowerCase().includes('format') || message.toLowerCase().includes('layout')) {
      mockReply = "For resume formatting, I recommend using a clean, professional layout with consistent spacing and fonts. Use bullet points for readability and keep your resume to 1-2 pages. Your current format could be improved by aligning dates consistently on the right side.";
    } else if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi')) {
      mockReply = "Hello! I'm your AI resume assistant. I can help you improve your resume by providing feedback on content, formatting, and suggestions for specific sections. What would you like help with today?";
    } else {
      mockReply = "I've analyzed your resume and have some suggestions. Your experience section could be more impactful with quantifiable achievements. Your skills section would benefit from categorization. Would you like specific advice on any particular section?";
    }
    
    return res.json({ reply: mockReply });
  }
  
  try {
    // Prepare conversation history for the API
    let messages = [
      {
        role: 'system',
        content: `You are an AI assistant specialized in resume writing and career advice. 
You provide professional, helpful, and concise guidance to help users improve their resumes.
${resumeText ? 'The user has shared their resume with you. Refer to it when providing specific advice.' : ''}
Focus on providing actionable advice and specific suggestions for improvements.`
      }
    ];
    
    // Add conversation history
    if (conversationHistory.length > 0) {
      messages = [...messages, ...conversationHistory];
    }
    
    // Add the current message
    if (resumeText && messages.length === 1) {
      // If this is the first user message and we have a resume, include it
      messages.push({
        role: 'user',
        content: `Here is my resume:
"""
${resumeText}
"""

${message}`
      });
    } else {
      // Otherwise just add the user message
      messages.push({
        role: 'user',
        content: message
      });
    }
    
    // Call the OpenAI API
    const chatResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: messages,
      temperature: 0.7
    });

    const reply = chatResponse.choices[0]?.message?.content || 'I apologize, but I was unable to process your request.';
    
    res.json({ 
      reply,
      // Return the updated conversation history
      conversationHistory: [
        ...messages.slice(1), // Skip the system message
        { role: 'assistant', content: reply }
      ]
    });
  } catch (err) {
    console.error('Chat Error:', err.response?.data || err.message);
    res.status(500).json({ error: '❌ Failed to process chat message.' });
  }
});

app.listen(PORT, () =>
  console.log(`✅ Resume Analyzer running at http://localhost:${PORT} in ${MOCK_MODE ? 'MOCK' : 'LIVE'} mode`)
);
