const express = require('express');
const bodyParser = require('body-parser');
const app = express();

app.use(bodyParser.text());
app.use(express.static('public')); // Serves index.html

app.post('/analyze', (req, res) => {
    const resumeText = req.body;
    const words = resumeText.split(/\s+/);
    const wordCount = words.length;

    const keywords = ['agile', 'docker', 'javascript', 'sql', 'python'];
    const keywordCounts = {};
    keywords.forEach(kw => {
        const count = resumeText.toLowerCase().split(kw).length - 1;
        keywordCounts[kw] = count;
    });

    res.json({
        wordCount,
        keywordCounts
    });
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
