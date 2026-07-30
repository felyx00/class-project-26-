const { supabase, supabaseAdmin } = require('../config/supabase');

exports.signUp = async (req, res, next) => {
  try {
    const { email, password, full_name, role, admission_number } = req.body;

    if (!email || !password || !full_name || !role) {
      return res.status(400).json({ error: 'Email, password, full name, and role are required.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const validRoles = ['student', 'university_supervisor', 'industry_supervisor', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name, role, admission_number: admission_number || null },
      },
    });

    if (error) return res.status(400).json({ error: error.message });

    res.status(201).json({
      message: data.session ? 'Account created.' : 'Account created. Check email to confirm.',
      session: data.session,
      user: data.user,
    });
  } catch (err) {
    next(err);
  }
};

exports.signIn = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return res.status(401).json({
        error: error.message === 'Invalid login credentials'
          ? 'Incorrect email or password.'
          : error.message,
      });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    res.json({
      session: data.session,
      user: profile,
    });
  } catch (err) {
    next(err);
  }
};

exports.signOut = async (req, res, next) => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Signed out.' });
  } catch (err) {
    next(err);
  }
};

exports.getMe = async (req, res) => {
  res.json({ user: req.user });
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${req.protocol}://${req.get('host')}/reset-password`,
    });

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Password reset email sent.' });
  } catch (err) {
    next(err);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { access_token, new_password } = req.body;
    if (!access_token || !new_password) {
      return res.status(400).json({ error: 'Access token and new password are required.' });
    }

    const { data, error } = await supabase.auth.updateUser({
      password: new_password,
    });

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    next(err);
  }
};
