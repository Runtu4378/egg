import { EggLogger } from 'egg-logger';
import { EggApplication, EggApplicationOptions } from './egg.js';
import { AgentWorkerLoader } from './loader/index.js';

const EGG_LOADER = Symbol.for('egg#loader');

/**
 * Singleton instance in Agent Worker, extend {@link EggApplication}
 * @augments EggApplication
 */
export class Agent extends EggApplication {
  readonly #agentAliveHandler: NodeJS.Timeout;

  /**
   * @class
   * @param {Object} options - see {@link EggApplication}
   */
  constructor(options?: Omit<EggApplicationOptions, 'type'>) {
    super({
      ...options,
      type: 'agent',
    });

    // keep agent alive even it doesn't have any io tasks
    this.#agentAliveHandler = setInterval(() => {
      this.coreLogger.info('[]');
    }, 24 * 60 * 60 * 1000);
  }

  get [EGG_LOADER]() {
    return AgentWorkerLoader;
  }

  _wrapMessenger() {
    for (const methodName of [
      'broadcast',
      'sendTo',
      'sendToApp',
      'sendToAgent',
      'sendRandom',
    ]) {
      wrapMethod(methodName, this.messenger, this.coreLogger);
    }

    function wrapMethod(methodName: string, messenger: any, logger: EggLogger) {
      const originMethod = messenger[methodName];
      messenger[methodName] = function(...args: any[]) {
        const stack = new Error().stack!.split('\n').slice(1).join('\n');
        logger.warn(
          "agent can't call %s before server started\n%s",
          methodName,
          stack,
        );
        originMethod.apply(this, args);
      };
      messenger.prependOnceListener('egg-ready', () => {
        messenger[methodName] = originMethod;
      });
    }
  }

  async close() {
    clearInterval(this.#agentAliveHandler);
    await super.close();
  }
}
