export function createHistoryManager({ limit = 200, isEqual, onChange }) {
  const state = {
    undoStack: [],
    redoStack: [],
    transaction: null
  };

  function notify() {
    onChange?.({
      canUndo: state.undoStack.length > 0,
      canRedo: state.redoStack.length > 0,
      undoLabel: state.undoStack.length > 0 ? state.undoStack[state.undoStack.length - 1].label : null,
      redoLabel: state.redoStack.length > 0 ? state.redoStack[state.redoStack.length - 1].label : null
    });
  }

  function pushEntry(entry) {
    state.undoStack.push(entry);
    if (state.undoStack.length > limit) {
      state.undoStack.shift();
    }
    state.redoStack = [];
    notify();
  }

  function record(label, before, after) {
    if (isEqual(before, after)) {
      return false;
    }

    pushEntry({ label, before, after, at: Date.now() });
    return true;
  }

  function begin(label, snapshot) {
    if (state.transaction) {
      return false;
    }

    state.transaction = { label, before: snapshot };
    return true;
  }

  function commit(snapshot) {
    if (!state.transaction) {
      return false;
    }

    const { label, before } = state.transaction;
    state.transaction = null;
    return record(label, before, snapshot);
  }

  function cancel() {
    state.transaction = null;
    return true;
  }

  function undo(restore) {
    if (state.undoStack.length === 0) {
      return null;
    }

    const entry = state.undoStack.pop();
    restore(entry.before);
    state.redoStack.push(entry);
    notify();
    return entry;
  }

  function redo(restore) {
    if (state.redoStack.length === 0) {
      return null;
    }

    const entry = state.redoStack.pop();
    restore(entry.after);
    state.undoStack.push(entry);
    notify();
    return entry;
  }

  function clear() {
    state.undoStack = [];
    state.redoStack = [];
    state.transaction = null;
    notify();
  }

  function hasOpenTransaction() {
    return !!state.transaction;
  }

  notify();

  return {
    begin,
    cancel,
    clear,
    commit,
    hasOpenTransaction,
    record,
    redo,
    undo
  };
}
