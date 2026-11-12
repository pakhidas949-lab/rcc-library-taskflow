import taskStore from '../store/taskStore.js';
import { ApiError } from '../utils/ApiError.js';
import { sanitizeText } from '../utils/sanitize.js';
import { parseNamespace } from '../utils/namespace.js';

/**
 * Business logic for the task resource.
 * Controllers stay thin: they translate HTTP <-> service calls.
 */

/** GET /api/tasks */
export const listTasks = ({ completed, search } = {}) => {
  let tasks = taskStore.all();

  if (completed !== undefined) {
    tasks = tasks.filter((task) => task.completed === completed);
  }
  if (search) {
    const needle = search.toLowerCase();
    tasks = tasks.filter((task) => task.text.toLowerCase().includes(needle));
  }

  return tasks;
};

/** GET /api/tasks/:id */
export const findTaskById = (id) => {
  const task = taskStore.find(id);
  if (!task) throw ApiError.notFound('Task not found');
  return { ...task };
};

/** POST /api/tasks */
export const createTask = ({ text, completed }) => {
  const cleanText = sanitizeText(text);
  if (!cleanText) throw ApiError.badRequest('Task text is required');
  return taskStore.create({ text: cleanText, completed: Boolean(completed) });
};

/** PUT /api/tasks/:id */
export const updateTask = (id, patch) => {
  const existing = taskStore.find(id);
  if (!existing) throw ApiError.notFound('Task not found');

  const update = {};
  if (patch.text !== undefined) {
    const cleanText = sanitizeText(patch.text);
    if (!cleanText) throw ApiError.badRequest('Task text is required');
    update.text = cleanText;
  }
  if (patch.completed !== undefined) {
    update.completed = Boolean(patch.completed);
  }

  return taskStore.update(id, update);
};

/** DELETE /api/tasks/:id */
export const deleteTask = (id) => {
  const removed = taskStore.remove(id);
  if (!removed) throw ApiError.notFound('Task not found');
  return true;
};

/**
 * GET /api/stats - aggregate counters for the dashboard KPI strip.
 * Tasks are grouped by their `[Namespace]` tag so each page can show
 * its own totals alongside the global ones.
 */
export const getStats = () => {
  const tasks = listTasks();
  const byNamespace = {};
  let completed = 0;

  tasks.forEach((task) => {
    const { namespace } = parseNamespace(task.text);
    const key = namespace || 'General';

    if (!byNamespace[key]) {
      byNamespace[key] = { total: 0, completed: 0, open: 0 };
    }
    byNamespace[key].total += 1;

    if (task.completed) {
      byNamespace[key].completed += 1;
      completed += 1;
    } else {
      byNamespace[key].open += 1;
    }
  });

  return {
    total: tasks.length,
    completed,
    open: tasks.length - completed,
    byNamespace,
  };
};

export default {
  listTasks,
  findTaskById,
  createTask,
  updateTask,
  deleteTask,
  getStats,
};
