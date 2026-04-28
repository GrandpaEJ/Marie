import { IMarieContext, MarieMiddleware } from '../types.js';

class MiddlewarePipeline {
  private middlewares: MarieMiddleware[] = [];

  use(middleware: MarieMiddleware): void {
    this.middlewares.push(middleware);
  }

  async execute(ctx: IMarieContext): Promise<void> {
    let index = -1;

    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) throw new Error('next() called multiple times');
      index = i;
      const fn = this.middlewares[i];
      if (!fn) return;

      await fn(ctx, dispatch.bind(null, i + 1));
    };

    await dispatch(0);
  }
}

export default MiddlewarePipeline;
