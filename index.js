const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { OpenAI } = require('openai');
const cors = require('cors');
require('dotenv').config();

// Helper function to validate JSON
function isValidJson(str) {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
}

// Helper function to build the prompt for resume analysis
function buildPrompt(resumeText, jobDescription) {
  return `
You are an expert ATS system and recruiter. Analyze this resume against the job description.
Provide detailed, actionable feedback.

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

Provide a JSON response with the following structure:
{
  "matchScore": <0-100 score based on overall match>,
  "skillsScore": <0-100 score based on required skills match>,
  "toolsScore": <0-100 score based on required tools/technologies match>,
  "matchedSkills": [<array of skills found in both resume and job description>],
  "missingSkills": [<array of required skills from job description not found in resume>],
  "suggestions": [<array of specific, actionable improvements>]
}

Focus on accuracy and actionable feedback.`.trim();
}

// Helper function to parse and validate the model response
function parseModelResponse(responseContent) {
  try {
    // First try to parse the JSON directly
    const parsed = JSON.parse(responseContent);
    
    // Validate the required fields
    const requiredFields = ['matchScore', 'skillsScore', 'toolsScore', 'matchedSkills', 'missingSkills', 'suggestions'];
    const missingFields = requiredFields.filter(field => !(field in parsed));
    
    if (missingFields.length > 0) {
      console.error('❌ Missing required fields in response:', missingFields);
      throw new Error('Invalid response format');
    }
    
    // Ensure scores are within valid range
    const scores = ['matchScore', 'skillsScore', 'toolsScore'];
    scores.forEach(score => {
      parsed[score] = Math.max(0, Math.min(100, parsed[score]));
    });
    
    // Ensure arrays are actually arrays
    ['matchedSkills', 'missingSkills', 'suggestions'].forEach(field => {
      if (!Array.isArray(parsed[field])) {
        parsed[field] = [];
      }
    });
    
    return parsed;
  } catch (error) {
    console.error('❌ Error parsing model response:', error);
    throw new Error('Failed to parse model response');
  }
}

const app = express();
const upload = multer();
const PORT = 3000;

// IMPORTANT: Set to true to use mock data and avoid API charges
const MOCK_MODE = process.env.MOCK_MODE === 'true';
if (!process.env.MOCK_MODE) {
  console.warn('⚠️ MOCK_MODE not set in .env file. Defaulting to LIVE mode.');
}
if (!process.env.OPENAI_KEY && !MOCK_MODE) {
  console.error('❌ OpenAI API key not configured and MOCK_MODE is false.');
}

const OPENAI_KEY = process.env.OPENAI_KEY;
// Use a fake API key in mock mode to prevent accidental API calls
const openai = new OpenAI({ apiKey: MOCK_MODE ? 'mock-key' : OPENAI_KEY });

const ADV_MODEL = process.env.ADV_MODEL || 'gpt-4o';

// Debug: Print mode at startup
console.log('🔧 APPLICATION MODE:', MOCK_MODE ? 'MOCK' : 'LIVE');
console.log('🔑 OpenAI API Key configured:', OPENAI_KEY ? 'YES' : 'NO');

app.use(cors());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.post('/analyze-resume', upload.single('resume'), async (req, res) => {
  try {
    const resumeBuffer = req.file.buffer;
    const resumeText = (await pdfParse(resumeBuffer)).text;
    const { jobDescription } = req.body;

    console.log('✅ Resume and JD received.');
    console.log('MOCK_MODE:', MOCK_MODE);
    console.log('📝 Job Description Length:', jobDescription?.length || 0);
    console.log('📄 Resume Text Length:', resumeText?.length || 0);

    if (!resumeText || !jobDescription) {
      console.error('❌ Missing resume or JD.');
      return res.status(400).json({ error: 'Missing resume or job description' });
    }

    if (MOCK_MODE) {
      console.log('📌 Using MOCK data for analysis');
      return res.json({
        matchScore: 76,
        skillsScore: 80,
        toolsScore: 65,
        matchedSkills: ["React", "JavaScript", "Git"],
        missingSkills: ["TypeScript", "Docker", "Agile"],
        suggestions: [
          "Mention Agile methodologies",
          "Include TypeScript experience",
          "Add metrics to React achievements"
        ]
      });
    }

    if (!OPENAI_KEY) {
      console.error('❌ OpenAI API key not configured');
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    console.log('🚀 Sending request to OpenAI...');
    const prompt = buildPrompt(resumeText, jobDescription);

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    });

    console.log('✅ Received response from OpenAI');
    const result = parseModelResponse(response.choices[0].message.content);
    return res.json(result);

  } catch (error) {
    console.error('❌ Error in /analyze-resume:', error);
    return res.status(500).json({ 
      error: 'Failed to analyze resume',
      details: error.message 
    });
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

    let resumeForAnalysis = resumeText;

    // Summarize if resume is long
    if (resumeText.length > 2000) {
      const summaryPrompt = `
Summarize the following resume section by section (Education, Experience, Skills, etc.).
Keep all key details, but make it as concise as possible for an AI to analyze.

Resume:
"""
${resumeText}
"""
Return ONLY the summary, no extra comments.
      `.trim();

      const summaryResponse = await openai.chat.completions.create({
        model: ADV_MODEL,
        messages: [{ role: 'user', content: summaryPrompt }],
        temperature: 0.2,
        max_tokens: 1024 // You can adjust this if needed
      });

      resumeForAnalysis = summaryResponse.choices[0]?.message?.content || resumeText;
    }

    const atsPrompt = `
🧠 You are ParsePro — the most advanced resume evaluator and recruiter assistant available. You simulate both:

1. A top-tier ATS (Applicant Tracking System) — scoring formatting, section structure, and keyword coverage.
2. A senior human recruiter — evaluating tone, clarity, value delivery, red flags, and career alignment.

🎯 Your job is to deliver direct, constructive, honest feedback that helps the user break into the top 5% of applicants. Think like a trusted coach and hiring manager — empowering, but factual.

---

📌 KEY RULES — FACTUAL ACCURACY:
- 🔍 All claims, strengths, and red flags must be visible in the resume text.
- ❌ Never assume career goals, role types, or skills unless explicitly stated.
- ⚠️ If the resume appears non-traditional (artistic, narrative, or creative format), adapt tone and highlight storytelling strengths over ATS performance.
- 🌐 If the resume is partially or fully in a non-English language, or contains multilingual content, analyze what you can and add:
  - "This resume includes content in multiple languages, which may affect ATS readability. Consider translating key sections (e.g., Experience, Skills) for standard ATS compatibility."

---

📦 OPTIONAL USER INPUT:
- If the user provides a **target role** (e.g., "data analyst"), tailor keyword alignment and feedback accordingly.
- If not, infer only from clearly labeled sections or experience titles.

---

⚠️ TOKEN/LENGTH SAFETY:
- If the resume text is **excessively long or near token limits**, summarize **each section** (Education, Experience, etc.) first, then deliver a condensed analysis.
- Include a note that analysis was summarized due to input size.

---

📌 ERROR HANDLING:
- If no resume is provided, return:
\`\`\`json
{ "error": "Resume content is missing. Please upload or paste your resume text." }
\`\`\`

---

🧾 RETURN FORMAT (JSON):

Return a JSON object with ALL of the following keys, 

{
  "🎯 Career Target": "Role inferred from resume or provided by user.",
  "📊 ATS Score (1–100)": "ATS compatibility based on headers, formatting, and keywords.",
  "🤝 Recruiter Score (1–10)": "Score based on clarity, storytelling, trust-building, tone, layout, and overall recruiter impression.",
  "🧭 Career Readiness Score (1–10)": "Score based on skills, project depth, domain experience, and measurable outcomes for the intended role.",
  "🧨 Resume Risk Level (Low / Medium / High)": "Realistic risk of rejection or misalignment in an early-screening environment. No sugarcoating.",
  "🔥 Priority Section": "Name the most important section in this JSON to focus on.",
  "✨ What Recruiters Will Love": [],
  "🛑 Major Gaps": [],
  "⚠️ Soft Issues": [],
  "🚫 Link or Info Red Flags": [],
  "📌 Why These Scores": [],
  "🔍 Keyword & Industry Alignment": [],
  "🗣️ Tone, Voice & Confidence Check": [],
  "📐 Formatting & ATS Compatibility": [],
  "🧠 Differentiation Factor": [],
  "🧰 Personal Brand & Identity": [],
  "📈 Growth & Learning Signals": [],
  "🚀 Top 5 Actionable Fixes": [],
  "📚 What to Learn or Build Next": [],
  "🧑‍🏫 Summary & Human Advice (1–2 Paragraphs)": "",
  "🔮 If I Were Your Recruiter...": ""
}

✅ Tip: Use the Top Fixes and Learning Suggestions above to revise your resume — then re-run this tool to track your improvement.

Here is the resume to analyze:
"""
${resumeForAnalysis}
"""
    `.trim();

    const atsResponse = await openai.chat.completions.create({
      model: ADV_MODEL,
      messages: [{ role: 'user', content: atsPrompt }],
      temperature: 0.2,
      max_tokens: 2048 // or higher if your model supports it
    });

    console.log('🧠 Raw ATS output:', atsResponse.choices[0]?.message?.content);

    let atsEvaluation = {};
    const rawATS = atsResponse.choices[0]?.message?.content || '';
    
    // Remove markdown block if it exists
    const cleanATS = rawATS.replace(/```json|```/g, '').trim();
    
    if (isValidJson(cleanATS)) {
      atsEvaluation = JSON.parse(cleanATS);
    } else {
      console.error('❌ OpenAI returned non-JSON:', rawATS);
      throw new Error('OpenAI response was not valid JSON. Check token limits or prompt format.');
    }

    const requiredKeys = [
      "🎯 Career Target", "📊 ATS Score (1–100)", "🤝 Recruiter Score (1–10)", "🧭 Career Readiness Score (1–10)",
      "🧨 Resume Risk Level (Low / Medium / High)", "🔥 Priority Section", "✨ What Recruiters Will Love", "🛑 Major Gaps",
      "⚠️ Soft Issues", "🚫 Link or Info Red Flags", "📌 Why These Scores", "🔍 Keyword & Industry Alignment",
      "🗣️ Tone, Voice & Confidence Check", "📐 Formatting & ATS Compatibility", "🧠 Differentiation Factor",
      "🧰 Personal Brand & Identity", "📈 Growth & Learning Signals", "🚀 Top 5 Actionable Fixes",
      "📚 What to Learn or Build Next", "🧑‍🏫 Summary & Human Advice (1–2 Paragraphs)", "🔮 If I Were Your Recruiter..."
    ];

    for (const key of requiredKeys) {
      if (!(key in atsEvaluation)) {
        atsEvaluation[key] = Array.isArray(atsEvaluation[key]) ? [] : "";
      }
    }

    // Normalize keys to match frontend expectations with consistent types
    const normalizedEvaluation = {
      inferredField: String(atsEvaluation['🎯 Career Target'] || '-'),
      atsScore: Number(atsEvaluation['📊 ATS Score (1–100)']) || 0,
      recruiterEngagementLikelihood: String(atsEvaluation['🤝 Recruiter Score (1–10)']
        ? `Score: ${atsEvaluation['🤝 Recruiter Score (1–10)']}`
        : '-'),
      toneAnalysis: String(atsEvaluation['🗣️ Tone, Voice & Confidence Check']?.[0] || '-'),
      riskLevel: String(atsEvaluation['🧨 Resume Risk Level'] || '-'),
      prioritySection: String(atsEvaluation['🔥 Priority Section'] || '-'),
      redFlags: Array.isArray(atsEvaluation['🛑 Major Gaps']) ? atsEvaluation['🛑 Major Gaps'] : [],
      softIssues: Array.isArray(atsEvaluation['⚠️ Soft Issues']) ? atsEvaluation['⚠️ Soft Issues'] : [],
      keywordAlignment: Array.isArray(atsEvaluation['🔍 Keyword & Industry Alignment']) ? atsEvaluation['🔍 Keyword & Industry Alignment'] : [],
      formattingNotes: Array.isArray(atsEvaluation['📐 Formatting & ATS Compatibility']) ? atsEvaluation['📐 Formatting & ATS Compatibility'] : [],
      topFixes: Array.isArray(atsEvaluation['🚀 Top 5 Actionable Fixes']) ? atsEvaluation['🚀 Top 5 Actionable Fixes'] : [],
      learningSuggestions: Array.isArray(atsEvaluation['📚 What to Learn or Build Next']) ? atsEvaluation['📚 What to Learn or Build Next'] : [],
      summaryAdvice: String(atsEvaluation['🧑‍🏫 Summary & Human Advice (1–2 Paragraphs)'] || ''),
      recruiterOpinion: String(atsEvaluation['🔮 If I Were Your Recruiter...'] || ''),
      whatRecruitersWillLove: Array.isArray(atsEvaluation['✨ What Recruiters Will Love']) ? atsEvaluation['✨ What Recruiters Will Love'] : [],
      differentiationFactor: Array.isArray(atsEvaluation['🧠 Differentiation Factor']) ? atsEvaluation['🧠 Differentiation Factor'] : [],
      personalBrand: Array.isArray(atsEvaluation['🧰 Personal Brand & Identity']) ? atsEvaluation['🧰 Personal Brand & Identity'] : [],
      growthSignals: Array.isArray(atsEvaluation['📈 Growth & Learning Signals']) ? atsEvaluation['📈 Growth & Learning Signals'] : [],
      whyTheseScores: Array.isArray(atsEvaluation['📌 Why These Scores']) ? atsEvaluation['📌 Why These Scores'] : [],
      linkRedFlags: Array.isArray(atsEvaluation['🚫 Link or Info Red Flags']) ? atsEvaluation['🚫 Link or Info Red Flags'] : [],
      careerReadinessScore: String(atsEvaluation['🧭 Career Readiness Score (1–10)'] || '-')
    };

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
      atsEvaluation: normalizedEvaluation,
      originalResumeHTML,
      plainTextResume: resumeText
    });
  } catch (err) {
    console.error('ATS Error:', err.response?.data || err.message);
    res.status(500).json({ error: '❌ Failed to retrieve ATS summary.' });
  }
});

// Chat endpoint for resume assistance with conversation history
app.post('/chat', async (req, res) => {
  const { message, resume } = req.body;
  console.log('Received in /chat:', { message, resume: resume?.slice(0, 200) });

  if (!message || !resume || resume.trim().length < 30) {
    return res.status(400).json({
      reply: 'No resume found. Please upload your resume first.'
    });
  }

  const systemPrompt = `
You are ParsePro's AI Resume Coach. The following is the user's full resume (plain text, from their upload).
You MUST answer ONLY using this resume. If you do not see any resume content, reply: 'No resume found.'
If you give generic advice, you will be penalized. You must quote or paraphrase at least two lines from the resume.
Do NOT give generic resume-writing advice. Keep the answer under 250 words using concise bullet points.
`;

  const MAX_RESUME_CHARS = 5000;
  let resumeForPrompt = resume;
  if (resume.length > MAX_RESUME_CHARS) {
    resumeForPrompt = resume.slice(0, MAX_RESUME_CHARS) + '\n...[truncated]\n';
  }

  const userContent = `QUESTION:\n${message}\n\nRESUME (plain text from user upload):\n"""\n${resumeForPrompt}\n"""`;

  const gptMessages = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userContent }
  ];

  try {
    const aiRes = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: gptMessages,
      temperature: 0
    });
    const reply = aiRes.choices[0]?.message?.content?.trim() ||
                  'Sorry, I had trouble generating an answer.';
    return res.json({ reply });
  } catch (err) {
    console.error('❌ /chat error', err);
    return res.status(500).json({
      reply: 'An internal error occurred.'
    });
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
      model: 'gpt-4o',
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

app.listen(PORT, () => {
  console.log(`✅ Resume Analyzer running at http://localhost:${PORT} in ${MOCK_MODE ? 'MOCK' : 'LIVE'} mode`);
});
