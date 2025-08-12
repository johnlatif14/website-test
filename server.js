require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const fs = require('fs');

const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // set to true if using HTTPS
}));

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (req.session.authenticated) {
    return next();
  }
  res.redirect('/login.html');
};

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/contact.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'contact.html'));
});

// Login route
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    req.session.authenticated = true;
    res.redirect('/dashboard.html');
  } else {
    res.redirect('/login.html?error=1');
  }
});

// Logout route
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login.html');
});

// Contact form submission
app.post('/submit-contact', (req, res) => {
  const { name, contact, details } = req.body;
  
  // Save to messages.json
  const message = {
    name,
    contact,
    details,
    date: new Date().toISOString()
  };
  
  let messages = [];
  try {
    messages = JSON.parse(fs.readFileSync('messages.json'));
  } catch (err) {
    // File doesn't exist or is empty
  }
  
  messages.push(message);
  fs.writeFileSync('messages.json', JSON.stringify(messages, null, 2));
  
  res.redirect('/contact.html?success=1');
});

// Get messages (for dashboard)
app.get('/api/messages', requireAuth, (req, res) => {
  try {
    const messages = JSON.parse(fs.readFileSync('messages.json'));
    res.json(messages);
  } catch (err) {
    res.json([]);
  }
});

// Send email route
app.post('/api/send-email', requireAuth, (req, res) => {
  const { to, subject, text } = req.body;
  
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  
  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text
  };
  
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    res.json({ success: true, info });
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});