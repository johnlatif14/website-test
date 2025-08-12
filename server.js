require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const nodemailer = require('nodemailer');
const session = require('express-session');

const app = express();

// Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// إعداد الجلسة
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // في الإنتاج يجب أن يكون true مع HTTPS
}));

// إعداد SMTP من ملف .env
const smtpConfig = {
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: false, // true لـ 465، false لـ 587
  auth: {
    user: process.env.SMTP_USERNAME,
    pass: process.env.SMTP_PASSWORD
  }
};

// تخزين الرسائل (في تطبيق حقيقي يستخدم قاعدة بيانات)
let messages = [];

// Middleware للتحقق من المصادقة
const requireAuth = (req, res, next) => {
  if (req.session.isAuthenticated) {
    return next();
  }
  res.redirect('/login');
};

// الصفحات الرئيسية
app.get('/contact.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'contact.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// معالجة تسجيل الدخول
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    req.session.isAuthenticated = true;
    res.redirect('/dashboard.html');
  } else {
    res.redirect('/login?error=invalid_credentials');
  }
});

// تسجيل الخروج
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// معالجة إرسال نموذج الاتصال
app.post('/submit-contact', (req, res) => {
  const { name, contact, details } = req.body;
  const newMessage = {
    name,
    contact,
    details,
    date: new Date().toISOString()
  };
  messages.push(newMessage);
  
  // إرسال البريد الإلكتروني
  const transporter = nodemailer.createTransport(smtpConfig);
  
  const mailOptions = {
    from: process.env.SMTP_FROM,
    to: process.env.SMTP_USERNAME,
    subject: `رسالة جديدة من ${name}`,
    text: `الاسم: ${name}\nطريقة الاتصال: ${contact}\nالتفاصيل: ${details}`
  };
  
  transporter.sendMail(mailOptions, (error) => {
    if (error) {
      console.error('فشل إرسال البريد:', error);
    }
  });
  
  res.redirect('/public/contact.html?success=true');
});

// API للحصول على الرسائل (محمية بالمصادقة)
app.get('/api/messages', requireAuth, (req, res) => {
  res.json(messages);
});

// معالجة حفظ إعدادات SMTP
app.post('/save-smtp', requireAuth, (req, res) => {
  // في تطبيق حقيقي، يجب حفظ هذه الإعدادات في قاعدة بيانات
  res.redirect('/dashboard?smtp_saved=true');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`الخادم يعمل على المنفذ ${PORT}`);
});