const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const admin = require('firebase-admin');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Initialize Firebase Admin SDK using environment variable
const serviceAccount = require('./icpl-platform-firebase-adminsdk-g22n4-7601bf7da3.json'); // Use .env for the path
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL, // Firebase database URL from .env
});

const db = admin.firestore();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000', // Client origin
  methods: ['GET', 'POST'], // Allowed HTTP methods
}));
app.use(bodyParser.json());

// Input Validation Middleware
const validateInput = (req, res, next) => {
  const { name, email } = req.body;

  if (!name || name.length < 3) {
    return res.status(400).send('Invalid name! Name must be at least 3 characters long.');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return res.status(400).send('Invalid email address!');
  }

  next();
};

// Add Rate Limiting
const saveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: 'Too many requests from this IP, please try again later.',
});

// Save Endpoint with Validation and Rate Limiting
app.post('/save', saveLimiter, validateInput, async (req, res) => {
  const { name, email } = req.body;

  try {
    const querySnapshot = await db.collection('airdropQualifiers').where('email', '==', email).get();
    if (!querySnapshot.empty) {
      return res.status(409).send('Email already exists!');
    }

    await db.collection('airdropQualifiers').add({
      name,
      email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(201).send('User added successfully!');
  } catch (error) {
    console.error('Error saving user data:', error);
    res.status(500).send('Internal server error');
  }
});

// Health Check Endpoint
app.get('/', (req, res) => {
  res.send('Backend server is running!');
});

// Start the server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));