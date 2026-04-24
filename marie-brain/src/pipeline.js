/**
 * A lightweight asynchronous middleware pipeline.
 * Follows the standard `async (ctx, next) => { ... }` pattern.
 */
class MiddlewarePipeline {
  constructor() {
    this.middlewares = [];
  }

  /**
   * Registers a middleware function.
   * @param {Function} fn - async (ctx, next)
   */
  use(fn) {
    if (typeof fn !== 'function') throw new TypeError('Middleware must be a function');
    this.middlewares.push(fn);
    return this; // For chaining
  }

  /**
   * Executes the pipeline with the given context.
   * @param {Object} context 
   */
  async execute(context) {
    let index = -1;

    const dispatch = async (i) => {
      if (i <= index) throw new Error('next() called multiple times');
      index = i;
      let fn = this.middlewares[i];

      // If we reached the end of the pipeline, just return
      if (!fn) return Promise.resolve();

      try {
        return Promise.resolve(fn(context, dispatch.bind(null, i + 1)));
      } catch (err) {
        return Promise.reject(err);
      }
    };

    return dispatch(0);
  }
}

export default MiddlewarePipeline;
