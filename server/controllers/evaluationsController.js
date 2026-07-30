const { supabase } = require('../config/supabase');

exports.list = async (req, res, next) => {
  try {
    let query = supabase
      .from('evaluations')
      .select('*')
      .order('created_at', { ascending: false });

    if (req.user.role === 'student') {
      query = query.eq('student_id', req.user.id);
    } else if (req.user.role !== 'admin') {
      const { data: placements } = await supabase
        .from('placements')
        .select('id')
        .or(`university_supervisor_id.eq.${req.user.id},industry_supervisor_id.eq.${req.user.id}`);
      const placementIds = (placements || []).map((p) => p.id);
      if (!placementIds.length) return res.json({ evaluations: [] });
      query = query.in('placement_id', placementIds);
    }

    if (req.query.placement_id) query = query.eq('placement_id', req.query.placement_id);
    if (req.query.milestone_type) query = query.eq('milestone_type', req.query.milestone_type);

    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    res.json({ evaluations: data || [] });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { placement_id, student_id, milestone_type, punctuality, technical, softskills, attendance, comments } = req.body;

    if (!placement_id || !student_id || !comments) {
      return res.status(400).json({ error: 'Placement, student, and comments are required.' });
    }

    const scores = { punctuality, technical, softskills, attendance };
    for (const [key, val] of Object.entries(scores)) {
      if (val === undefined || val < 1 || val > 5) {
        return res.status(400).json({ error: `${key} must be between 1 and 5.` });
      }
    }

    const { data, error } = await supabase
      .from('evaluations')
      .insert({
        placement_id,
        student_id,
        supervisor_id: req.user.id,
        milestone_type: milestone_type || 'midterm',
        punctuality,
        technical,
        softskills,
        attendance,
        comments,
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ evaluation: data });
  } catch (err) {
    next(err);
  }
};
