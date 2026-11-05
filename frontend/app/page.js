
'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, ListTodo, Clock3, CheckCircle2,
  Plus, Search, Trash2, Pencil, X, CalendarDays,
  Sun, Moon, LayoutGrid, List, AlertCircle,
  ArrowUpDown, Menu, Target, LoaderCircle
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

const initialTask = {
  title: '',
  description: '',
  status: 'Pending',
  priority: 'Medium',
  due_date: ''
};

const statuses = ['Pending', 'In Progress', 'Completed'];

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (response.status === 204) return null;

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }

  return data;
}

function dateLabel(value) {
  if (!value) return 'No due date';

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);

  return Number.isNaN(date.getTime())
    ? 'Invalid date'
    : date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
}

function StatusBadge({ status }) {
  const colors = {
    Pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    'In Progress': 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    Completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
  };

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${colors[status] || colors.Pending}`}>
      {status}
    </span>
  );
}

function TaskCard({ task, onEdit, onDelete, onDetails }) {
  const priorityColors = {
    High: 'bg-rose-500',
    Medium: 'bg-amber-500',
    Low: 'bg-emerald-500'
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileHover={{ y: -4 }}
      className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-xl dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <StatusBadge status={task.status} />
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <span className={`h-2 w-2 rounded-full ${priorityColors[task.priority] || priorityColors.Medium}`} />
          {task.priority}
        </div>
      </div>

      <button
        onClick={() => onDetails(task)}
        className="text-left text-lg font-bold text-slate-900 hover:text-indigo-600 dark:text-white"
      >
        {task.title}
      </button>

      <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-6 text-slate-500 dark:text-slate-400">
        {task.description || 'No description provided.'}
      </p>

      <div className="mt-5 flex items-center gap-2 text-xs text-slate-500">
        <CalendarDays size={15} />
        {dateLabel(task.due_date)}
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
        <button
          onClick={() => onDetails(task)}
          className="text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
        >
          View details
        </button>

        <div className="flex gap-2">
          <button
            onClick={() => onEdit(task)}
            aria-label={`Edit ${task.title}`}
            className="rounded-lg p-2 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-800"
          >
            <Pencil size={17} />
          </button>
          <button
            onClick={() => onDelete(task)}
            aria-label={`Delete ${task.title}`}
            className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-slate-800"
          >
            <Trash2 size={17} />
          </button>
        </div>
      </div>
    </motion.article>
  );
}

export default function Home() {
  const [tasks, setTasks] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All Tasks');
  const [sort, setSort] = useState('newest');
  const [view, setView] = useState('grid');
  const [dark, setDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(initialTask);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    setDark(localStorage.getItem('task-theme') === 'dark');
  }, []);

  useEffect(() => {
    localStorage.setItem('task-theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError('');

      try {
        const data = await api('/tasks', {
          signal: controller.signal
        });
        if (!controller.signal.aborted) {
          setTasks(data);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    load();
    return () => controller.abort();
  }, [refresh]);

  const visibleTasks = useMemo(() => {
    let result = tasks.filter(task => {
      const matchesSearch =
        `${task.title} ${task.description || ''}`
          .toLowerCase()
          .includes(search.toLowerCase());

      const matchesFilter =
        filter === 'All Tasks' || task.status === filter;

      return matchesSearch && matchesFilter;
    });

    result = [...result];

    if (sort === 'priority') {
      const order = { High: 0, Medium: 1, Low: 2 };
      result.sort((a, b) => order[a.priority] - order[b.priority]);
    }

    if (sort === 'due') {
      result.sort((a, b) =>
        (a.due_date || '9999-12-31').localeCompare(
          b.due_date || '9999-12-31'
        )
      );
    }

    if (sort === 'newest') {
      result.sort((a, b) => Number(b.id) - Number(a.id));
    }

    return result;
  }, [tasks, search, filter, sort]);

  const completed = tasks.filter(t => t.status === 'Completed').length;
  const pending = tasks.filter(t => t.status === 'Pending').length;
  const progress = tasks.filter(t => t.status === 'In Progress').length;
  const percentage = tasks.length
    ? Math.round((completed / tasks.length) * 100)
    : 0;

  const navigation = [
    { name: 'All Tasks', icon: LayoutDashboard, count: tasks.length },
    { name: 'Pending', icon: ListTodo, count: pending },
    { name: 'In Progress', icon: Clock3, count: progress },
    { name: 'Completed', icon: CheckCircle2, count: completed }
  ];

  function openForm(task = null) {
    setForm(task
      ? {
          title: task.title || '',
          description: task.description || '',
          status: task.status || 'Pending',
          priority: task.priority || 'Medium',
          due_date: task.due_date
            ? String(task.due_date).slice(0, 10)
            : ''
        }
      : { ...initialTask }
    );
    setFormError('');
    setModal({ type: 'form', task });
  }

  async function showDetails(task) {
    setModal({ type: 'details', task, loading: true });

    try {
      const detail = await api(`/tasks/${task.id}`);
      setModal(current =>
        current?.type === 'details' && current.task.id === task.id
          ? { type: 'details', task: detail, loading: false }
          : current
      );
    } catch (err) {
      setModal(current =>
        current?.type === 'details' && current.task.id === task.id
          ? { ...current, loading: false, error: err.message }
          : current
      );
    }
  }

  async function mutate(action, message) {
    setBusy(true);
    setFormError('');

    try {
      await action();
      setModal(null);
      setNotice(message);
      setRefresh(n => n + 1);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function saveTask(e) {
    e.preventDefault();

    if (!form.title.trim()) {
      setFormError('Task title is required.');
      return;
    }

    const id = modal.task?.id;

    mutate(
      () => api(id ? `/tasks/${id}` : '/tasks', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(form)
      }),
      id ? 'Task updated successfully!' : 'Task created successfully!'
    );
  }

  return (
    <div className={dark ? 'dark' : ''}>
      <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">

        {/* SIDEBAR */}
        <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-slate-200 bg-white p-5 transition-transform dark:border-slate-800 dark:bg-slate-900 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="mb-12 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-indigo-600 p-2 text-white">
                <Target size={23} />
              </div>
              <span className="text-xl font-extrabold tracking-tight">TaskFlow</span>
            </div>
            <button className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X size={20} />
            </button>
          </div>

          <p className="mb-4 px-3 text-xs font-bold uppercase tracking-widest text-slate-400">
            Workspace
          </p>

          <nav className="space-y-2">
            {navigation.map(item => (
              <button
                key={item.name}
                onClick={() => {
                  setFilter(item.name);
                  setSidebarOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  filter === item.name
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-3">
                  <item.icon size={19} />
                  {item.name}
                </span>
                <span className="text-xs opacity-70">{item.count}</span>
              </button>
            ))}
          </nav>

          <div className="mt-12 rounded-2xl bg-indigo-50 p-5 dark:bg-indigo-500/10">
            <div className="mb-3 flex items-center gap-2 font-bold text-indigo-700 dark:text-indigo-300">
              <Target size={18} /> Your Progress
            </div>
            <div className="mb-3 flex items-center justify-between text-sm">
              <span>Tasks completed</span>
              <strong>{percentage}%</strong>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-indigo-100 dark:bg-slate-700">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                className="h-full rounded-full bg-indigo-600"
              />
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Keep moving forward, one task at a time.
            </p>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <div className="lg:ml-64">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 px-5 py-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90 md:px-8">
            <div className="flex items-center gap-3">
              <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
                <Menu size={23} />
              </button>
              <span className="text-sm font-semibold text-slate-500">
                Workspace / {filter}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setDark(!dark)}
                aria-label="Toggle dark mode"
                className="rounded-xl border border-slate-200 p-2.5 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                {dark ? <Sun size={19} /> : <Moon size={19} />}
              </button>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 font-bold text-white">
                TF
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-7xl p-5 md:p-8">
            <div className="mb-9 flex flex-wrap items-center justify-between gap-5">
              <div>
                <p className="mb-2 text-sm font-bold text-indigo-600">
                  YOUR PRODUCTIVITY SPACE
                </p>
                <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
                  Welcome to TaskFlow <span>👋</span>
                </h1>
                <p className="mt-3 text-slate-500 dark:text-slate-400">
                  Stay organized, focused, and productive every day.
                </p>
              </div>

              <button
                onClick={() => openForm()}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-700 hover:scale-105"
              >
                <Plus size={20} /> Create Task
              </button>
            </div>

            {/* STATISTICS */}
            <div className="mb-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { title: 'Total Tasks', value: tasks.length, icon: ListTodo, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
                { title: 'Pending', value: pending, icon: Clock3, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10' },
                { title: 'In Progress', value: progress, icon: Target, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-500/10' },
                { title: 'Completed', value: completed, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10' }
              ].map((stat, i) => (
                <motion.div
                  key={stat.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className={`mb-5 inline-flex rounded-xl p-3 ${stat.bg} ${stat.color}`}>
                    <stat.icon size={22} />
                  </div>
                  <p className="text-sm text-slate-500">{stat.title}</p>
                  <p className="mt-2 text-3xl font-extrabold">{stat.value}</p>
                </motion.div>
              ))}
            </div>

            {/* TASK TOOLBAR */}
            <section>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold">Your Tasks</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Manage and track your daily activities.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setView('grid')}
                    aria-label="Grid view"
                    className={`rounded-lg p-2.5 ${view === 'grid' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 dark:bg-slate-800'}`}
                  >
                    <LayoutGrid size={19} />
                  </button>
                  <button
                    onClick={() => setView('list')}
                    aria-label="List view"
                    className={`rounded-lg p-2.5 ${view === 'list' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 dark:bg-slate-800'}`}
                  >
                    <List size={19} />
                  </button>
                </div>
              </div>

              <div className="mb-6 flex flex-wrap gap-3">
                <div className="relative min-w-52 flex-1">
                  <Search size={18} className="absolute left-4 top-3.5 text-slate-400" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search your tasks..."
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900"
                  />
                </div>
                <select
                  value={sort}
                  onChange={e => setSort(e.target.value)}
                  aria-label="Sort tasks"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="newest">Newest first</option>
                  <option value="priority">By priority</option>
                  <option value="due">By due date</option>
                </select>
              </div>

              {notice && (
                <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-500/10">
                  {notice}
                </p>
              )}

              {error ? (
                <div role="alert" className="rounded-2xl bg-red-50 p-8 text-center text-red-600">
                  <AlertCircle className="mx-auto mb-3" />
                  <p>{error}</p>
                  <button onClick={() => setRefresh(n => n + 1)} className="mt-4 underline">
                    Retry
                  </button>
                </div>
              ) : loading ? (
                <div className="flex justify-center py-20">
                  <LoaderCircle className="animate-spin text-indigo-600" size={32} />
                </div>
              ) : visibleTasks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-16 text-center dark:border-slate-700">
                  <ListTodo size={42} className="mx-auto mb-4 text-slate-400" />
                  <h3 className="text-xl font-bold">No tasks found</h3>
                  <p className="mt-2 text-slate-500">Create a task or change your filters.</p>
                  <button onClick={() => openForm()} className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 text-white">
                    Create Task
                  </button>
                </div>
              ) : (
                <div className={view === 'grid'
                  ? 'grid gap-5 md:grid-cols-2 xl:grid-cols-3'
                  : 'grid gap-4'
                }>
                  <AnimatePresence>
                    {visibleTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onEdit={openForm}
                        onDetails={showDetails}
                        onDelete={task => {
                          setFormError('');
                          setModal({ type: 'delete', task });
                        }}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </section>
          </main>
        </div>

        {/* MODAL */}
        <AnimatePresence>
          {modal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
              onMouseDown={e => {
                if (e.target === e.currentTarget && !busy) setModal(null);
              }}
            >
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
                initial={{ opacity: 0, scale: 0.9, y: 25 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 md:p-8"
              >
                <div className="mb-6 flex items-center justify-between">
                  <h2 id="modal-title" className="text-2xl font-bold">
                    {modal.type === 'form'
                      ? modal.task ? 'Edit Task' : 'Create New Task'
                      : modal.type === 'delete' ? 'Delete Task' : 'Task Details'}
                  </h2>
                  <button disabled={busy} onClick={() => setModal(null)} aria-label="Close dialog">
                    <X size={22} />
                  </button>
                </div>

                {modal.type === 'form' && (
                  <form onSubmit={saveTask} className="space-y-5">
                    <label className="block text-sm font-semibold">
                      Task Title
                      <input
                        required
                        maxLength={200}
                        value={form.title}
                        onChange={e => setForm({ ...form, title: e.target.value })}
                        placeholder="Enter task title"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-transparent p-3 outline-none focus:border-indigo-500 dark:border-slate-700"
                      />
                    </label>

                    <label className="block text-sm font-semibold">
                      Description
                      <textarea
                        rows={4}
                        maxLength={5000}
                        value={form.description}
                        onChange={e => setForm({ ...form, description: e.target.value })}
                        placeholder="Describe your task..."
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-transparent p-3 outline-none focus:border-indigo-500 dark:border-slate-700"
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-4">
                      <label className="text-sm font-semibold">
                        Status
                        <select
                          value={form.status}
                          onChange={e => setForm({ ...form, status: e.target.value })}
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
                        >
                          {statuses.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </label>
                      <label className="text-sm font-semibold">
                        Priority
                        <select
                          value={form.priority}
                          onChange={e => setForm({ ...form, priority: e.target.value })}
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
                        >
                          {['Low', 'Medium', 'High'].map(p => <option key={p}>{p}</option>)}
                        </select>
                      </label>
                    </div>

                    <label className="block text-sm font-semibold">
                      Due Date
                      <input
                        type="date"
                        required
                        value={form.due_date}
                        onChange={e => setForm({ ...form, due_date: e.target.value })}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-transparent p-3 dark:border-slate-700"
                      />
                    </label>

                    {formError && <p role="alert" className="text-sm text-red-500">{formError}</p>}

                    <button
                      disabled={busy}
                      className="w-full rounded-xl bg-indigo-600 py-3 font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {busy ? 'Saving...' : modal.task ? 'Update Task' : 'Create Task'}
                    </button>
                  </form>
                )}

                {modal.type === 'details' && (
                  <div className="space-y-4">
                    {modal.loading ? (
                      <p>Loading details...</p>
                    ) : modal.error ? (
                      <p className="text-red-500">{modal.error}</p>
                    ) : (
                      <>
                        <h3 className="text-xl font-bold">{modal.task.title}</h3>
                        <p className="whitespace-pre-wrap text-slate-500">{modal.task.description || 'No description.'}</p>
                        <StatusBadge status={modal.task.status} />
                        <p>Priority: <strong>{modal.task.priority}</strong></p>
                        <p>Due: {dateLabel(modal.task.due_date)}</p>
                        <button
                          onClick={() => openForm(modal.task)}
                          className="rounded-xl bg-indigo-600 px-5 py-3 text-white"
                        >
                          Edit Task
                        </button>
                      </>
                    )}
                  </div>
                )}

                {modal.type === 'delete' && (
                  <div>
                    <p className="text-slate-500">
                      Are you sure you want to delete <strong>{modal.task.title}</strong>?
                      This action cannot be undone.
                    </p>
                    {formError && <p className="mt-3 text-red-500">{formError}</p>}
                    <div className="mt-7 flex justify-end gap-3">
                      <button
                        disabled={busy}
                        onClick={() => setModal(null)}
                        className="rounded-xl border border-slate-200 px-5 py-3 dark:border-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => mutate(
                          () => api(`/tasks/${modal.task.id}`, { method: 'DELETE' }),
                          'Task deleted successfully!'
                        )}
                        className="rounded-xl bg-red-600 px-5 py-3 font-bold text-white"
                      >
                        {busy ? 'Deleting...' : 'Delete Task'}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
