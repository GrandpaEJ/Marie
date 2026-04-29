import EventEmitter from 'events';
export declare const EVENTS: {
    MESSAGE: string;
    COMMAND_EXECUTED: string;
    LOG: string;
};
declare class EventBus extends EventEmitter {
}
declare const _default: EventBus;
export default _default;
