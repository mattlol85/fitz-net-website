/**
 * Folds a turn stream event (docs/ai-chat-contract.md section 7.2) into the assistant message
 * that is being generated. Returns a new message; unknown events leave it untouched.
 *
 * Besides the server's Message fields the client keeps two transient ones:
 *   live          { phase, text } while the node loads the model or fails over, else null
 *   alternatives  the `error` event's one-click failover targets (part 2 renders them)
 */
export function applyTurnEvent(message, name, data) {
  switch (name) {
    case 'meta':
      return {
        ...message,
        id: data.assistantMessageId ?? message.id,
        live: null,
        generation: {
          ...message.generation,
          nodeId: data.nodeId,
          nodeName: data.nodeName,
          model: data.model,
          auto: Boolean(data.auto),
          presetId: data.presetId ?? null,
          contextLength: data.contextLength ?? null,
        },
        context: data.context ?? null,
      };

    case 'status':
      if (data.phase === 'loading_model') {
        const model = data.model || message.generation?.model;
        const node = message.generation?.nodeName;
        return {
          ...message,
          live: {
            phase: data.phase,
            text: model && node ? `Loading ${model} on ${node}…` : data.message || 'Loading the model…',
          },
        };
      }
      if (data.phase === 'failover') {
        return { ...message, live: { phase: data.phase, text: data.message || 'Trying another node…' } };
      }
      return { ...message, live: null };

    case 'thinking':
      return { ...message, live: null, thinking: `${message.thinking || ''}${data.content || ''}` };

    case 'token':
      return { ...message, live: null, content: `${message.content || ''}${data.content || ''}` };

    case 'done':
      return {
        ...message,
        id: data.messageId ?? message.id,
        status: 'complete',
        live: null,
        contextOverflow: Boolean(data.contextOverflow),
        generation: {
          ...message.generation,
          promptTokens: data.promptTokens,
          completionTokens: data.completionTokens,
          contextLength: data.contextLength ?? message.generation?.contextLength ?? null,
          finishReason: data.finishReason,
          ...data.stats,
        },
      };

    case 'error':
      return {
        ...message,
        id: data.messageId ?? message.id,
        status: 'error',
        live: null,
        error: { code: data.code, message: data.message },
        retryable: data.retryable,
        alternatives: data.alternatives ?? [],
        generation: message.generation ? { ...message.generation, finishReason: 'error' } : message.generation,
      };

    default:
      return message;
  }
}
