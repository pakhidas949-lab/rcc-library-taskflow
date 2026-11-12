import { z } from 'zod';

/**
 * Shared task field limits.
 */
export const TASK_TEXT_MIN = 1;
export const TASK_TEXT_MAX = 255;

/**
 * Schema for POST /api/tasks
 * - `text` is required, must be a non-empty string after trimming.
 * - `completed` is optional and defaults to false.
 * Unknown keys are stripped (not rejected) so the client can send extra
 * metadata without breaking the request.
 */
export const createTaskSchema = z.object({
  text: z
    .string({ required_error: 'Task text is required', invalid_type_error: 'Task text must be a string' })
    .trim()
    .min(TASK_TEXT_MIN, 'Task text is required')
    .max(TASK_TEXT_MAX, `Task text must be ${TASK_TEXT_MAX} characters or less`),
  completed: z
    .boolean({ invalid_type_error: 'completed must be a boolean' })
    .optional()
    .default(false),
});

/**
 * Schema for PUT /api/tasks/:id
 * Both fields are optional, but at least one must be supplied - otherwise
 * the request would be a no-op.
 */
export const updateTaskSchema = z
  .object({
    text: z
      .string({ invalid_type_error: 'Task text must be a string' })
      .trim()
      .min(TASK_TEXT_MIN, 'Task text is required')
      .max(TASK_TEXT_MAX, `Task text must be ${TASK_TEXT_MAX} characters or less`)
      .optional(),
    completed: z.boolean({ invalid_type_error: 'completed must be a boolean' }).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one of "text" or "completed" must be provided',
  });

/**
 * Schema for query-string filters: GET /api/tasks?completed=true
 */
export const listTasksQuerySchema = z.object({
  completed: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  search: z.string().trim().max(TASK_TEXT_MAX).optional(),
});
