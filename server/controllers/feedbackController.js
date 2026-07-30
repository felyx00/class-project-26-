const { supabase } = require('../config/supabase');

exports.create = async (req, res, next) => {
  try {
    const { entry_id, comments, score, decision } = req.body;

    if (!entry_id || !comments) {
      return res.status(400).json({ error: 'Entry ID and comments are required.' });
    }

    const { data: fb, error: fbError } = await supabase
      .from('feedback')
      .insert({
        entry_id,
        supervisor_id: req.user.id,
        comments,
        score: score != null ? parseInt(score, 10) : null,
        status: decision || 'verified',
      })
      .select()
      .single();

    if (fbError) return res.status(400).json({ error: fbError.message });

    const { error: enError } = await supabase
      .from('logbook_entries')
      .update({ status: decision || 'verified' })
      .eq('id', entry_id);

    if (enError) console.error('Failed to update entry status:', enError);

    res.status(201).json({ feedback: fb });
  } catch (err) {
    next(err);
  }
};

exports.listByEntry = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('feedback')
      .select('*, supervisor:supervisor_id(full_name)')
      .eq('entry_id', req.params.entryId)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.json({ feedback: data || [] });
  } catch (err) {
    next(err);
  }
};
