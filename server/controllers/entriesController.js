const { supabase } = require('../config/supabase');

exports.list = async (req, res, next) => {
  try {
    let query = supabase
      .from('logbook_entries')
      .select('*, feedback(*), entry_attachments(*)')
      .order('entry_date', { ascending: false });

    if (req.user.role === 'student') {
      query = query.eq('student_id', req.user.id);
    } else if (req.user.role !== 'admin') {
      const { data: placements } = await supabase
        .from('placements')
        .select('student_id')
        .or(`university_supervisor_id.eq.${req.user.id},industry_supervisor_id.eq.${req.user.id}`);
      const studentIds = (placements || []).map((p) => p.student_id);
      if (!studentIds.length) return res.json({ entries: [] });
      query = query.in('student_id', studentIds);
    }

    if (req.query.status) query = query.eq('status', req.query.status);
    if (req.query.student_id) query = query.eq('student_id', req.query.student_id);
    if (req.query.search) {
      query = query.or(`title.ilike.%${req.query.search}%,activities.ilike.%${req.query.search}%`);
    }
    if (req.query.sort) {
      const dir = req.query.dir === 'asc' ? { ascending: true } : { ascending: false };
      query = query.order(req.query.sort, dir);
    }
    if (req.query.page && req.query.per_page) {
      const page = parseInt(req.query.page, 10) || 1;
      const perPage = Math.min(parseInt(req.query.per_page, 10) || 20, 100);
      const from = (page - 1) * perPage;
      const to = from + perPage - 1;
      query = query.range(from, to);
    }

    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });

    const { count } = await supabase
      .from('logbook_entries')
      .select('*', { count: 'exact', head: true });

    res.json({ entries: data || [], total: count });
  } catch (err) {
    next(err);
  }
};

exports.get = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('logbook_entries')
      .select('*, feedback(*), entry_attachments(*)')
      .eq('id', req.params.id)
      .single();

    if (error) return res.status(404).json({ error: 'Entry not found.' });
    res.json({ entry: data });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { entry_date, entry_type, title, activities, learning_points, challenges, placement_id } = req.body;

    if (!title || !activities || !entry_date) {
      return res.status(400).json({ error: 'Date, title, and activities are required.' });
    }

    const { data, error } = await supabase
      .from('logbook_entries')
      .insert({
        student_id: req.user.id,
        placement_id: placement_id || null,
        entry_date,
        entry_type: entry_type || 'daily',
        title,
        activities,
        learning_points: learning_points || null,
        challenges: challenges || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ entry: data });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const updates = {};
    const fields = ['title', 'activities', 'learning_points', 'challenges', 'entry_date', 'entry_type', 'status'];
    for (const field of fields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const { data, error } = await supabase
      .from('logbook_entries')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ entry: data });
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('logbook_entries')
      .delete()
      .eq('id', req.params.id);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Entry deleted.' });
  } catch (err) {
    next(err);
  }
};
