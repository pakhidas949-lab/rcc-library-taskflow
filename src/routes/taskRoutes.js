import { Router } from 'express';
import {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
} from '../controllers/taskController.js';
import { createTaskSchema, updateTaskSchema, listTasksQuerySchema } from '../models/taskSchema.js';
import { validate } from '../middleware/validate.js';
import { writeRateLimiter } from '../middleware/rateLimiter.js';

/**
 * Builds the task router.
 *
 * @param {object} [options]
 * @param {import('express').RequestHandler} [options.writeLimiter]
 *        Pass `null` to disable the stricter write limiter.
 */
export const createTaskRouter = ({ writeLimiter = writeRateLimiter } = {}) => {
  const router = Router();

  const write = (handler) => (writeLimiter ? [writeLimiter, handler] : [handler]);

  router
    .route('/')
    .get(validate(listTasksQuerySchema, 'query'), getTasks)
    .post(...write(validate(createTaskSchema)), createTask);

  router
    .route('/:id')
    .get(getTaskById)
    .put(...write(validate(updateTaskSchema)), updateTask)
    .patch(...write(validate(updateTaskSchema)), updateTask)
    .delete(...write(deleteTask));

  return router;
};

export default createTaskRouter();
