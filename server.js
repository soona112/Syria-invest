require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.options('/chat', cors());

// Middleware Configuration
app.use(cors({
  origin: ['https://soona112.github.io', 'http://localhost:3000'], // Allowed domains
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Hugging Face API Settings
const HF_MODEL = "microsoft/DialoGPT-medium"; // Official model name
const HF_API_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;
const HF_API_KEY = process.env.HF_API_KEY;

// Chat History Management
let chatContext = {
  past_user_inputs: [],
  generated_responses: []
};

// Enhanced Chat Endpoint
app.post('/chat', async (req, res) => {
  try {
    const userMessage = req.body.message;
    
    // Prepare conversation context
    const payload = {
      inputs: {
        ...chatContext,
        text: userMessage
      },
      parameters: {
        max_length: 200,  // Response length limit
        temperature: 0.9, // Creativity level
        repetition_penalty: 1.2 // Avoid repetition
      }
    };

    // API Request
    const response = await axios.post(HF_API_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HF_API_KEY}`
      },
      timeout: 30000 // 30-second timeout
    });

    // Update conversation history
    chatContext.past_user_inputs.push(userMessage);
    chatContext.generated_responses.push(response.data.generated_text);

    res.json({ 
      message: response.data.generated_text,
      conversation_id: Date.now() // Optional tracking
    });

  } catch (error) {
    console.error('API Error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    
    res.status(error.response?.status || 500).json({
      error: 'AI service error',
      details: error.response?.data?.error || 'Service unavailable'
    });
  }
});

// Health Check Endpoint
app.get('/status', (req, res) => {
  res.json({ 
    status: 'operational',
    model: HF_MODEL,
    timestamp: new Date().toISOString()
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🟢 Server running on port ${PORT}`);
  console.log(`🔗 Model Endpoint: ${HF_API_URL}`);
});
// Add this near your other endpoints
app.get('/', (req, res) => {
  res.json({
    status: 'API Server Running',
    endpoints: {
      chat: 'POST /chat',
      status: 'GET /status'
    },
    documentation: 'https://your-docs-link.com'
  });
});
