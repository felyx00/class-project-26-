const { supabase } = require('../config/supabase');

exports.list = async (req, res, next) => {
  try {
    let query = supabase
      .from('placements')
      .select('*, student:student_id(full_name, admission_number), uni_sup:university_supervisor_id(full_name), ind_sup:industry_supervisor_id(full_name)')
      .order('created_at', { ascending: false });

    if (req.user.role === 'student') {
      query = query.eq('student_id', req.user.id);
    } else if (req.user.role !== 'admin') {
      query = query.or(`university_supervisor_id.eq.${req.user.id},industry_supervisor_id.eq.${req.user.id}`);
    }

    if (req.query.status) query = query.eq('status', req.query.status);

    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    res.json({ placements: data || [] });
  } catch (err) {
    next(err);
  }
};

exports.get = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('placements')
      .select('*, student:student_id(*), uni_sup:university_supervisor_id(*), ind_sup:industry_supervisor_id(*)')
      .eq('id', req.params.id)
      .single();

    if (error) return res.status(404).json({ error: 'Placement not found.' });
    res.json({ placement: data });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { student_id, organisation_name, organisation_address, university_supervisor_id, industry_supervisor_id, start_date, end_date } = req.body;

    if (!student_id || !organisation_name) {
      return res.status(400).json({ error: 'Student and organisation name are required.' });
    }

    const { data, error } = await supabase
      .from('placements')
      .insert({
        student_id,
        organisation_name,
        organisation_address: organisation_address || null,
        university_supervisor_id: university_supervisor_id || null,
        industry_supervisor_id: industry_supervisor_id || null,
        start_date: start_date || null,
        end_date: end_date || null,
        status: 'active',
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ placement: data });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const updates = {};
    const fields = ['organisation_name', 'organisation_address', 'university_supervisor_id', 'industry_supervisor_id', 'start_date', 'end_date', 'status'];
    for (const field of fields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const { data, error } = await supabase
      .from('placements')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ placement: data });
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('placements')
      .delete()
      .eq('id', req.params.id);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Placement deleted.' });
  } catch (err) {
    next(err);
  }
};
