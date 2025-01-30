require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 10000;

// Middleware setup
app.use(cors({
  origin: [
    'https://soona112.github.io', // Match root domain
    'https://soona112.github.io/Syria-invest/', // Explicit path
    'http://localhost:3000'
  ],
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Hugging Face API configuration
const HF_MODEL = "microsoft/DialoGPT-medium";
const HF_API_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;
const HF_API_KEY = process.env.HF_API_KEY;

// Conversation context management
let chatContext = {
  past_user_inputs: [],
  generated_responses: []
};

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'API Server Running',
    version: '1.0.0',
    endpoints: {
      chat: 'POST /chat',
      status: 'GET /status'
    },
    documentation: 'https://github.com/soona112/Syria-invest'
  });
});

// Chat endpoint
app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Invalid message format' });
    }

    // Prepare payload for Hugging Face API
    const payload = {
      inputs: {
        ...chatContext,
        text: message
      },
      parameters: {
        max_length: 200,
        temperature: 0.9,
        repetition_penalty: 1.2,
        return_full_text: false
      }
    };

    // Make API request
    const response = await axios.post(HF_API_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HF_API_KEY}`
      },
      timeout: 45000 // 45 seconds timeout
    });

    // Update conversation context
    chatContext.past_user_inputs.push(message);
    chatContext.generated_responses.push(response.data.generated_text);

    // Send response
    res.json({
      message: response.data.generated_text,
      conversation_id: Date.now(),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Chat Error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });

    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.error || 'AI service error';

    res.status(statusCode).json({
      error: errorMessage,
      details: statusCode === 503 ? 'Model is loading, please try again in a few seconds' : undefined
    });
  }
});

// Health check endpoint
app.get('/status', (req, res) => {
  res.json({
    status: 'operational',
    model: HF_MODEL,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    available_endpoints: {
      root: 'GET /',
      chat: 'POST /chat',
      status: 'GET /status'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🟢 Server running on port ${PORT}`);
  console.log(`🔗 Model Endpoint: ${HF_API_URL}`);
  console.log(`🌐 Allowed Origins: https://soona112.github.io/Syria-invest, http://localhost:3000`);
});
