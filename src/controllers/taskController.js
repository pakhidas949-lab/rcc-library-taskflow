import * as taskService from '../services/taskService.js';
import { parseId } from '../utils/sanitize.js';
import { ApiError } from '../utils/ApiError.js';
/**
 * HTTP layer for the task resource.
 * Each handler translates the HTTP request into a service call and picks
 * the correct status code + response envelope.
 */

/** GET /api/tasks */
export const getTasks = (req, res, next) => {
  try {
    const { completed, search } = req.validatedQuery || {};
    const tasks = taskService.listTasks({ completed, search });
    res.status(200).json({ success: true, count: tasks.length, data: tasks });
  } catch (error) {
    next(error);
  }
};

/** GET /api/tasks/:id */
export const getTaskById = (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) throw ApiError.notFound('Task not found');

    const task = taskService.findTaskById(id);
    res.status(200).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};

/** POST /api/tasks */
export const createTask = (req, res, next) => {
  try {
    const task = taskService.createTask(req.body);
    res
      .status(201)
      .location(`/api/tasks/${task.id}`)
      .json({ success: true, message: 'Task created', data: task });
  } catch (error) {
    next(error);
  }
};

/** PUT /api/tasks/:id */
export const updateTask = (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) throw ApiError.notFound('Task not found');

    const task = taskService.updateTask(id, req.body);
    res.status(200).json({ success: true, message: 'Task updated', data: task });
  } catch (error) {
    next(error);
  }
};

/** DELETE /api/tasks/:id */
export const deleteTask = (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) throw ApiError.notFound('Task not found');

    taskService.deleteTask(id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

/** GET /api/stats - aggregate counters for the dashboard KPI strip */
export const getStats = (req, res, next) => {
  try {
    const stats = taskService.getStats();
    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};

export default {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  getStats,
};