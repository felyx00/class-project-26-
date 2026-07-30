const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');
const { authenticate } = require('./middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error('Only images and PDF files are allowed.'));
  },
});

const authRoutes = require('./routes/auth');
const entriesRoutes = require('./routes/entries');
const placementsRoutes = require('./routes/placements');
const evaluationsRoutes = require('./routes/evaluations');
const feedbackRoutes = require('./routes/feedback');
const profilesRoutes = require('./routes/profiles');

const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});
app.use('/api/', limiter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

app.use('/api/auth', authRoutes);
app.use('/api/entries', entriesRoutes);
app.use('/api/placements', placementsRoutes);
app.use('/api/evaluations', evaluationsRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/profiles', profilesRoutes);

app.use('/api/upload', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    const { supabase } = require('./config/supabase');
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided.' });
    }
    const file = req.file;
    const filePath = req.user.id + '/' + Date.now() + '-' + file.originalname;
    const { data, error } = await supabase.storage
      .from(config.supabase.attachmentsBucket)
      .upload(filePath, file.buffer, { contentType: file.mimetype });

    if (error) return res.status(400).json({ error: error.message });
    const { data: urlData } = supabase.storage.from(config.supabase.attachmentsBucket).getPublicUrl(filePath);

    res.json({ url: urlData.publicUrl, path: filePath });
  } catch (err) {
    next(err);
  }
});

app.use('/api/config', (req, res) => {
  res.json({
    supabaseUrl: config.supabase.url,
    supabaseAnonKey: config.supabase.anonKey,
    attachmentsBucket: config.supabase.attachmentsBucket,
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`SITS API server running on port ${config.port} [${config.nodeEnv}]`);
});

module.exports = app;
