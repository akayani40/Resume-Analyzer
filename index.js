const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const app = express();
const upload = multer();

app.use(bodyParser.text());
app.use(express.static('public'));
app.use(bodyParser.json()); // For handling JSON (used in /match-job)

// ✅ Shared keyword list
const keywords = [
  'agile', 'scrum', 'jira', 'github', 'docker', 'kubernetes',
  'javascript', 'typescript', 'node', 'react', 'angular',
  'sql', 'nosql', 'mongodb', 'firebase', 'python', 'java',
  'aws', 'gcp', 'azure', 'rest', 'api', 'ci/cd', 'tdd'
];

// ✅ Utility function for keyword counting
function analyzeText(text) {
  const cleaned = text.toLowerCase().replace(/[^a-z\s]/g, '');
  const words = cleaned.split(/\s+/);
  const wordCount = words.length;

  const keywordCounts = {};
  keywords.forEach(kw => {
    keywordCounts[kw] = cleaned.split(kw).length - 1;
  });

  return { wordCount, keywordCounts };
}

// ✅ Analyze pasted resume text
app.post('/analyze', (req, res) => {
  const { wordCount, keywordCounts } = analyzeText(req.body);
  res.json({ wordCount, keywordCounts });
});

// ✅ Analyze uploaded PDF file
app.post('/upload-pdf', upload.single('resume'), async (req, res) => {
  try {
    const data = await pdfParse(req.file.buffer);
    const { wordCount, keywordCounts } = analyzeText(data.text);
    res.json({ wordCount, keywordCounts });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error processing PDF');
  }
});

// ✅ Compare resume vs job description
app.post('/match-job', (req, res) => {
  const { resumeText, jobDescription } = req.body;

  const cleanText = (text) =>
    text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);

  const resumeWords = new Set(cleanText(resumeText));
  const jobWords = new Set(cleanText(jobDescription));

  const matchingKeywords = [];
  const missingKeywords = [];

  jobWords.forEach(word => {
    if (resumeWords.has(word)) {
      matchingKeywords.push(word);
    } else {
      missingKeywords.push(word);
    }
  });

  const matchPercent = Math.round(
    (matchingKeywords.length / jobWords.size) * 100
  );

  res.json({
    matchPercent,
    matchingKeywords,
    missingKeywords
  });
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
