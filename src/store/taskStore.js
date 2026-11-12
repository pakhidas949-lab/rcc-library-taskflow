/**
 * In-memory data store for tasks.
 *
 * This is a deliberate placeholder - Task 4 swaps it for a real database.
 * Keeping it behind a class means the swap touches one file only.
 */

const SEED_TASKS = [
  { text: 'Wire up the TaskFlow REST API', completed: false },
  { text: 'Replace localStorage with the API client', completed: false },
  { text: 'Write the Postman test collection', completed: true },
];

class TaskStore {
  constructor() {
    /** @type {Array<{id:number,text:string,completed:boolean,createdAt:string,updatedAt:string}>} */
    this.tasks = [];
    this.currentId = 1;
  }

  /** All tasks, newest first. */
  all() {
    return [...this.tasks].sort((a, b) => b.id - a.id);
  }

  /** Find a task by id (or undefined). */
  find(id) {
    return this.tasks.find((task) => task.id === id);
  }

  /** Insert a task and return it. */
  create({ text, completed = false }) {
    const now = new Date().toISOString();
    const task = {
      id: this.currentId++,
      text,
      completed,
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.push(task);
    return { ...task };
  }

  /** Apply a partial patch to a task and return the updated copy. */
  update(id, patch) {
    const index = this.tasks.findIndex((task) => task.id === id);
    if (index === -1) return undefined;

    const updated = {
      ...this.tasks[index],
      ...patch,
      id: this.tasks[index].id,
      updatedAt: new Date().toISOString(),
    };
    this.tasks[index] = updated;
    return { ...updated };
  }

  /** Remove a task. Returns true when something was removed. */
  remove(id) {
    const index = this.tasks.findIndex((task) => task.id === id);
    if (index === -1) return false;
    this.tasks.splice(index, 1);
    return true;
  }

  /** Remove every task (used by the test suite). */
  clear() {
    this.tasks = [];
    this.currentId = 1;
  }

  /** Insert sample data (used when SEED_DATA=true). */
  seed(items = SEED_TASKS) {
    items.forEach((item) => this.create(item));
  }
}

export const taskStore = new TaskStore();
export { TaskStore, SEED_TASKS };
export default taskStore;
