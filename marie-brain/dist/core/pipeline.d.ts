import { IMarieContext, MarieMiddleware } from '../types.js';
declare class MiddlewarePipeline {
    private middlewares;
    use(middleware: MarieMiddleware): void;
    execute(ctx: IMarieContext): Promise<void>;
}
export default MiddlewarePipeline;
