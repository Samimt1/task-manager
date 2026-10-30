export const statuses = ['Pending', 'In Progress', 'Completed'];
export const priorities = ['Low', 'Medium', 'High'];

export function validateTask(body) {
  const errors = {};
  const { title, description, status, priority, due_date } = body ?? {};
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 200)
    errors.title = 'Enter a title between 1 and 200 characters.';
  if (typeof description !== 'string' || description.length > 5000)
    errors.description = 'Description must be text, up to 5,000 characters.';
  if (!statuses.includes(status)) errors.status = 'Choose a valid status.';
  if (!priorities.includes(priority)) errors.priority = 'Choose a valid priority.';
  const date = typeof due_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(due_date)
    ? new Date(`${due_date}T00:00:00.000Z`) : new Date(NaN);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== due_date || due_date < '0001-01-01')
    errors.due_date = 'Enter a valid due date.';
  return errors;
}
