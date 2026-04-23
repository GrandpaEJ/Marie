import EventEmitter from 'eventemitter3';

const eventBus = new EventEmitter();

export const EVENTS = {
  MESSAGE_RECEIVED: 'message_received',
  COMMAND_EXECUTED: 'command_executed',
  LLM_START: 'llm_start',
  LLM_END: 'llm_end',
  ERROR: 'error'
};

export default eventBus;
