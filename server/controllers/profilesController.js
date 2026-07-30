const { supabase } = require('../config/supabase');

exports.get = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) return res.status(404).json({ error: 'Profile not found.' });
    res.json({ profile: data });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const allowed = ['full_name', 'admission_number', 'course', 'phone', 'avatar_url'];
    const updates = {};
    for (const field of allowed) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ profile: data });
  } catch (err) {
    next(err);
  }
};

exports.listStudents = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .order('full_name');

    if (error) return res.status(400).json({ error: error.message });
    res.json({ students: data || [] });
  } catch (err) {
    next(err);
  }
};

exports.listSupervisors = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['university_supervisor', 'industry_supervisor'])
      .order('full_name');

    if (error) return res.status(400).json({ error: error.message });
    res.json({ supervisors: data || [] });
  } catch (err) {
    next(err);
  }
};
