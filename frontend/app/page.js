'use client';

import { useEffect, useRef, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const statuses = ['Pending', 'In Progress', 'Completed'];
const emptyTask = { title: '', description: '', status: 'Pending', priority: 'Medium', due_date: '' };
const badgeClass = (value) => value.toLowerCase().replaceAll(' ', '-');
const formatDate = (value) => new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Something went wrong. Please try again.');
  return data;
}

function Modal({ title, children, onClose, busy }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    return () => { dialog.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="modal-heading"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" disabled={busy} onClick={onClose}>×</button></div>
    {children}
  </dialog>;
}

export default function Home() {
  const [tasks, setTasks] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyTask);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const timer = setTimeout(async () => {
      try {
        const query = new URLSearchParams({ search });
        if (status) query.set('status', status);
        setTasks(await request(`/tasks?${query}`, { signal: controller.signal }));
      } catch (err) { if (!controller.signal.aborted) setError(err.message === 'Failed to fetch' ? 'Cannot reach the API. Check that the backend is running, then retry.' : err.message); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, status, refresh]);

  function openForm(task) {
    setForm(task ? { ...task } : { ...emptyTask });
    setFormError('');
    setModal({ type: 'form', task });
  }
  async function showDetails(task) {
    setFormError('');
    setModal({ type: 'details', task, loading: true });
    try {
      const detail = await request(`/tasks/${task.id}`);
      setModal((current) => current?.type === 'details' && current.task.id === task.id ? { type: 'details', task: detail } : current);
    } catch (err) { setModal((current) => current?.type === 'details' && current.task.id === task.id ? { ...current, loading: false, error: err.message } : current); }
  }
  async function mutate(action, success) {
    setBusy(true);
    setFormError('');
    try { await action(); setModal(null); setNotice(success); setRefresh((n) => n + 1); }
    catch (err) { setFormError(err.message); }
    finally { setBusy(false); }
  }
  function save(event) {
    event.preventDefault();
    if (!form.title.trim()) { setFormError('Please enter a task title.'); return; }
    const id = modal.task?.id;
    mutate(() => request(id ? `/tasks/${id}` : '/tasks', { method: id ? 'PUT' : 'POST', body: JSON.stringify(form) }), id ? 'Task updated.' : 'Task created.');
  }
  const completed = tasks.filter((task) => task.status === 'Completed').length;

  return <main>
    <header className="topbar"><a className="brand" href="/" aria-label="Task Manager home"><span className="brand-icon">✓</span> Task Manager</a><span className="workspace-label">YOUR PERSONAL WORKSPACE</span></header>
    <section className="page-heading"><div><p className="eyebrow">A LITTLE STRUCTURE. A LOT OF PROGRESS.</p><h1>Make room for what matters.</h1><p className="subtitle">Organize your work, keep your focus, and move things forward.</p></div><button className="primary" onClick={() => openForm(null)}>＋ Add Task</button></section>
    <section className="stats" aria-label="Task overview"><div><span>Matching tasks</span><strong>{loading || error ? '—' : tasks.length}</strong></div><div><span>In progress</span><strong>{loading || error ? '—' : tasks.filter((task) => task.status === 'In Progress').length}</strong></div><div><span>Completed</span><strong>{loading || error ? '—' : completed}</strong></div></section>
    <section className="task-section"><div className="section-heading"><h2>Your tasks <span>Everything you need, in one place.</span></h2></div>
      <div className="toolbar"><div className="tabs" aria-label="Filter by status">{['', ...statuses].map((value) => <button key={value} className={status === value ? 'active' : ''} aria-pressed={status === value} onClick={() => setStatus(value)}>{value || 'All tasks'}</button>)}</div><input className="search" type="search" aria-label="Search tasks" placeholder="Search tasks…" maxLength={200} value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      <p className="notice" role="status">{notice}</p>
      {error ? <div className="state error" role="alert"><p>{error}</p><button onClick={() => setRefresh((n) => n + 1)}>Retry</button></div> : loading ? <div className="state" role="status">Loading your tasks…</div> : tasks.length === 0 ? <div className="state"><span className="empty-icon">✓</span><h3>{search || status ? 'No matching tasks' : 'A fresh start'}</h3><p>{search || status ? 'Try a different search or status filter.' : 'Add your first task and give your next idea a place to land.'}</p>{!search && !status && <button className="primary" onClick={() => openForm(null)}>＋ Add your first task</button>}</div> : <div className="task-grid">{tasks.map((task) => <article className="task-card" key={task.id}><div className="card-top"><span className={`badge ${badgeClass(task.status)}`}>{task.status}</span><span className={`priority ${badgeClass(task.priority)}`}>● {task.priority}</span></div><button className="task-title" onClick={() => showDetails(task)}>{task.title}</button><p className="description">{task.description || 'No description added.'}</p><div className="due-date">◷ Due {formatDate(task.due_date)}</div><div className="card-footer"><button onClick={() => showDetails(task)}>View details</button><div><button onClick={() => openForm(task)}>Edit</button><button className="danger-text" onClick={() => { setFormError(''); setModal({ type: 'delete', task }); }}>Delete</button></div></div></article>)}</div>}
    </section><footer>One task at a time. You’ve got this.</footer>
    {modal && <Modal title={modal.type === 'delete' ? 'Delete task?' : modal.type === 'details' ? 'Task details' : modal.task ? 'Edit task' : 'Add a new task'} busy={busy} onClose={() => setModal(null)}>
      {modal.type === 'form' && <form onSubmit={save}><label>Title<input autoFocus required maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Prepare interview presentation" /></label><label>Description<textarea maxLength={5000} rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What needs to get done?" /></label><div className="form-row"><label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{statuses.map((s) => <option key={s}>{s}</option>)}</select></label><label>Priority<select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{['Low', 'Medium', 'High'].map((p) => <option key={p}>{p}</option>)}</select></label></div><label>Due date<input type="date" required min="0001-01-01" max="9999-12-31" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></label>{formError && <p className="error" role="alert">{formError}</p>}<div className="modal-actions"><button type="button" disabled={busy} onClick={() => setModal(null)}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save task'}</button></div></form>}
      {modal.type === 'details' && (modal.loading ? <p role="status">Loading task details…</p> : modal.error ? <p className="error" role="alert">{modal.error}</p> : <div><h3>{modal.task.title}</h3><p className="detail-description">{modal.task.description || 'No description added.'}</p><dl><dt>Status</dt><dd>{modal.task.status}</dd><dt>Priority</dt><dd>{modal.task.priority}</dd><dt>Due date</dt><dd>{formatDate(modal.task.due_date)}</dd></dl><div className="modal-actions"><button className="primary" onClick={() => openForm(modal.task)}>Edit task</button></div></div>)}
      {modal.type === 'delete' && <div><p>Delete “{modal.task.title}”? This action cannot be undone.</p>{formError && <p className="error" role="alert">{formError}</p>}<div className="modal-actions"><button disabled={busy} onClick={() => setModal(null)}>Cancel</button><button className="danger" disabled={busy} onClick={() => mutate(() => request(`/tasks/${modal.task.id}`, { method: 'DELETE' }), 'Task deleted.')}>{busy ? 'Deleting…' : 'Delete task'}</button></div></div>}
    </Modal>}
  </main>;
}
