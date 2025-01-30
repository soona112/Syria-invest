// Load environment variables first
require('dotenv').config();
const express = require('express');
const app = express(); // Initialize app here
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const mongoose = require('mongoose');
const User = require('./models/User');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI);

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Passport setup
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'Server is healthy' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'Syria.html'));
});

app.post('/chat', async (req, res) => {
  try {
    const response = await axios.post(
      'http://localhost:11434/api/generate',
      {
        model: "deepseek-r1:1.5b",
        prompt: `[SYSTEM] You are an expert investment advisor specializing in Syria. Provide concise, factual answers. [USER] ${req.body.message}`,
        stream: false,
        options: {
          temperature: 0.7,
          max_tokens: 200
        }
      }
    );
    res.json({ message: response.data.response });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: "Failed to process chat request", details: error.message });
  }
});

// Authentication routes
app.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const user = await User.register(new User({ username, email }), password);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/login', passport.authenticate('local'), (req, res) => {
  res.json({ success: true, user: req.user });
});

app.post('/logout', (req, res) => {
  req.logout();
  res.json({ success: true });
});

// Protected routes
app.get('/dashboard', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.post('/upload', isAuthenticated, upload.single('document'), (req, res) => {
  User.findById(req.user._id, (err, user) => {
    user.documents.push({
      name: req.file.originalname,
      path: req.file.path,
      uploadedAt: new Date()
    });
    user.save();
    res.json({ success: true });
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', { message: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Helper function for authentication
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
}