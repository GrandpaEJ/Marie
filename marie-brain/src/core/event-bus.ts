import EventEmitter from 'events';

export const EVENTS = {
  MESSAGE: 'message',
  COMMAND_EXECUTED: 'command_executed',
  LOG: 'log'
};

class EventBus extends EventEmitter {}

export default new EventBus();
