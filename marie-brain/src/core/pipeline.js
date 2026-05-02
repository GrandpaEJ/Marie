class MiddlewarePipeline {
    middlewares = [];
    use(middleware) {
        this.middlewares.push(middleware);
    }
    async execute(ctx) {
        let index = -1;
        const dispatch = async (i) => {
            if (i <= index)
                throw new Error('next() called multiple times');
            index = i;
            const fn = this.middlewares[i];
            if (!fn)
                return;
            await fn(ctx, dispatch.bind(null, i + 1));
        };
        await dispatch(0);
    }
}
export default MiddlewarePipeline;
