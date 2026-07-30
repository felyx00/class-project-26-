var SITS = (function() {

  var CONFIG = {
    supabaseUrl: 'https://yffmpfdzrbwhuacvrhth.supabase.co',
    supabaseAnonKey: 'sb_publishable_eeqbo_Q3delLSZvfXkIKiw_85mzu_Am',
    attachmentsBucket: 'entry-attachments',
    staleEntryDays: 7,
    staleReviewDays: 5,
    apiBase: '/api',
  };

  var sb = supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);

  function getSb() { return sb; }

  function getConfig() { return CONFIG; }

  /* Auth */
  async function signUp(email, password, options) {
    return sb.auth.signUp({ email: email, password: password, options: options });
  }

  async function signIn(email, password) {
    return sb.auth.signInWithPassword({ email: email, password: password });
  }

  async function signOut() {
    return sb.auth.signOut();
  }

  async function getSession() {
    var result = await sb.auth.getSession();
    return result.data.session;
  }

  async function getProfile(userId) {
    return sb.from('profiles').select('*').eq('id', userId).single();
  }

  async function updateProfile(userId, updates) {
    return sb.from('profiles').update(updates).eq('id', userId);
  }

  /* Entries */
  async function fetchEntries(query) {
    return sb.from('logbook_entries').select('*, feedback(*), entry_attachments(*)').match(query).order('entry_date', { ascending: false });
  }

  async function createEntry(data) {
    return sb.from('logbook_entries').insert(data).select().single();
  }

  async function updateEntryStatus(id, status) {
    return sb.from('logbook_entries').update({ status: status }).eq('id', id);
  }

  /* Placements */
  async function fetchPlacements(query) {
    return sb.from('placements').select('*, student:student_id(full_name, admission_number), uni_sup:university_supervisor_id(full_name), ind_sup:industry_supervisor_id(full_name)').match(query).order('created_at', { ascending: false });
  }

  async function createPlacement(data) {
    return sb.from('placements').insert(data);
  }

  /* Feedback */
  async function createFeedback(data) {
    return sb.from('feedback').insert(data);
  }

  /* Evaluations */
  async function fetchEvaluations(query) {
    return sb.from('evaluations').select('*').match(query).order('created_at', { ascending: false });
  }

  async function createEvaluation(data) {
    return sb.from('evaluations').insert(data);
  }

  /* Profiles */
  async function fetchAllStudents() {
    return sb.from('profiles').select('*').eq('role', 'student');
  }

  /* Storage */
  async function uploadFile(bucket, path, file) {
    return sb.storage.from(bucket).upload(path, file);
  }

  function getPublicUrl(bucket, path) {
    return sb.storage.from(bucket).getPublicUrl(path);
  }

  async function createAttachment(data) {
    return sb.from('entry_attachments').insert(data);
  }

  /* Admin */
  async function fetchAdminData() {
    var results = await Promise.all([
      sb.from('placements').select('*, student:student_id(full_name, admission_number), uni_sup:university_supervisor_id(full_name)').order('created_at', { ascending: false }),
      sb.from('profiles').select('*').eq('role', 'student'),
      sb.from('logbook_entries').select('*, feedback(*), entry_attachments(*), profiles:student_id(full_name)').order('entry_date', { ascending: false }),
      sb.from('evaluations').select('*'),
    ]);
    return {
      placements: results[0].data || [],
      students: results[1].data || [],
      evaluations: results[3].data || [],
      entries: (results[2].data || []).map(function(e) {
        var fb = (e.feedback && e.feedback.length) ? e.feedback[0] : null;
        return {
          id: e.id, title: e.title, type: e.entry_type, date: e.entry_date,
          activities: e.activities, learning: e.learning_points, challenges: e.challenges,
          status: e.status, feedback: fb ? fb.comments : null, score: fb ? fb.score : null,
          reviewer: null, studentId: e.student_id,
          studentName: e.profiles ? e.profiles.full_name : 'Unknown',
          attachments: e.entry_attachments || [],
          created_at: e.created_at,
        };
      }),
    };
  }

  /* Supervisor helper */
  async function fetchSupervisorEntries(userId) {
    var plRes = await sb
      .from('placements')
      .select('id, student_id, organisation_name, start_date, profiles:student_id(full_name, admission_number)')
      .or('university_supervisor_id.eq.' + userId + ',industry_supervisor_id.eq.' + userId);

    var placements = plRes.data || [];
    var studentIds = placements.map(function(p) { return p.student_id; });
    if (!studentIds.length) return { entries: [], students: placements };

    var enRes = await sb
      .from('logbook_entries')
      .select('*, feedback(*), entry_attachments(*), profiles:student_id(full_name, admission_number)')
      .in('student_id', studentIds)
      .order('entry_date', { ascending: false });

    var mapped = (enRes.data || []).map(function(e) {
      var fb = (e.feedback && e.feedback.length) ? e.feedback[0] : null;
      return {
        id: e.id, title: e.title, type: e.entry_type, date: e.entry_date,
        activities: e.activities, learning: e.learning_points, challenges: e.challenges,
        status: e.status,
        feedback: fb ? fb.comments : null,
        score: fb ? fb.score : null,
        reviewer: fb ? null : null,
        studentName: e.profiles ? e.profiles.full_name : 'Unknown student',
        studentId: e.student_id,
        attachments: e.entry_attachments || [],
        created_at: e.created_at,
      };
    });

    return { entries: mapped, students: placements };
  }

  return {
    getSb: getSb,
    getConfig: getConfig,
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    getSession: getSession,
    getProfile: getProfile,
    updateProfile: updateProfile,
    fetchEntries: fetchEntries,
    createEntry: createEntry,
    updateEntryStatus: updateEntryStatus,
    fetchPlacements: fetchPlacements,
    createPlacement: createPlacement,
    createFeedback: createFeedback,
    fetchEvaluations: fetchEvaluations,
    createEvaluation: createEvaluation,
    fetchAllStudents: fetchAllStudents,
    uploadFile: uploadFile,
    getPublicUrl: getPublicUrl,
    createAttachment: createAttachment,
    fetchAdminData: fetchAdminData,
    fetchSupervisorEntries: fetchSupervisorEntries,
  };
})();
