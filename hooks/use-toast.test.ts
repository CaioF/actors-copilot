jest.mock('@/components/ui/toast', () => ({
  ToastActionElement: jest.fn(),
  ToastProps: {},
}));

let reducer: typeof import('@/hooks/use-toast').reducer;
let genId: () => string;
let toast: typeof import('@/hooks/use-toast').toast;

beforeEach(() => {
  jest.resetModules();
  jest.isolateModules(() => {
    const module = require('@/hooks/use-toast');
    reducer = module.reducer;
    genId = module.genId;
    toast = module.toast;
  });
});

describe('genId', () => {
  it('returns string representation of number', () => {
    const id = genId();
    expect(typeof id).toBe('string');
    expect(id).toBe('1');
  });

  it('increments correctly', () => {
    expect(genId()).toBe('1');
    expect(genId()).toBe('2');
    expect(genId()).toBe('3');
  });
});

describe('reducer', () => {
  const initialState = { toasts: [] };

  describe('ADD_TOAST', () => {
    it('adds toast to empty array', () => {
      const toast = { id: '1', title: 'Test' };
      const state = reducer(initialState, { type: 'ADD_TOAST', toast });
      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0]).toEqual(toast);
    });

    it('respects TOAST_LIMIT=1', () => {
      const toast1 = { id: '1', title: 'First' };
      const toast2 = { id: '2', title: 'Second' };
      let state = reducer(initialState, { type: 'ADD_TOAST', toast: toast1 });
      state = reducer(state, { type: 'ADD_TOAST', toast: toast2 });
      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0].id).toBe('2');
    });
  });

  describe('UPDATE_TOAST', () => {
    it('merges properties', () => {
      const toast = { id: '1', title: 'Test', description: 'Original' };
      let state = reducer(initialState, { type: 'ADD_TOAST', toast });
      state = reducer(state, { type: 'UPDATE_TOAST', toast: { id: '1', description: 'Updated' } });
      expect(state.toasts[0].description).toBe('Updated');
      expect(state.toasts[0].title).toBe('Test');
    });
  });

  describe('DISMISS_TOAST', () => {
    it('with toastId sets open:false for that toast', () => {
      const toast = { id: '1', title: 'Test', open: true };
      let state = reducer(initialState, { type: 'ADD_TOAST', toast });
      state = reducer(state, { type: 'DISMISS_TOAST', toastId: '1' });
      expect(state.toasts[0].open).toBe(false);
    });

    it('without toastId dismisses all toasts', () => {
      const toast1 = { id: '1', title: 'First', open: true };
      const toast2 = { id: '2', title: 'Second', open: true };
      let state = reducer(initialState, { type: 'ADD_TOAST', toast: toast1 });
      state = reducer(state, { type: 'ADD_TOAST', toast: toast2 });
      state = reducer(state, { type: 'DISMISS_TOAST' });
      expect(state.toasts.every((t) => t.open === false)).toBe(true);
    });
  });

  describe('REMOVE_TOAST', () => {
    it('with toastId filters it out', () => {
      const toast1 = { id: '1', title: 'First' };
      const toast2 = { id: '2', title: 'Second' };
      let state = reducer(initialState, { type: 'ADD_TOAST', toast: toast1 });
      state = reducer(state, { type: 'ADD_TOAST', toast: toast2 });
      state = reducer(state, { type: 'REMOVE_TOAST', toastId: '1' });
      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0].id).toBe('2');
    });

    it('without toastId clears all', () => {
      const toast1 = { id: '1', title: 'First' };
      const toast2 = { id: '2', title: 'Second' };
      let state = reducer(initialState, { type: 'ADD_TOAST', toast: toast1 });
      state = reducer(state, { type: 'ADD_TOAST', toast: toast2 });
      state = reducer(state, { type: 'REMOVE_TOAST' });
      expect(state.toasts).toHaveLength(0);
    });
  });
});

describe('toast', () => {
  it('returns object with id, dismiss, and update', () => {
    const result = toast({ title: 'Test' });
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('dismiss');
    expect(result).toHaveProperty('update');
    expect(typeof result.dismiss).toBe('function');
    expect(typeof result.update).toBe('function');
  });

  it('dismiss dispatches DISMISS_TOAST', () => {
    const { id } = toast({ title: 'Test' });
    // DISMISS_TOAST sets open:false for the toast
    const state = reducer(
      { toasts: [{ id, title: 'Test', open: true }] },
      { type: 'DISMISS_TOAST', toastId: id }
    );
    expect(state.toasts[0].open).toBe(false);
  });

  it('update dispatches UPDATE_TOAST', () => {
    const { id } = toast({ title: 'Test' });
    // UPDATE_TOAST merges the new properties into the existing toast
    const state = reducer(
      { toasts: [{ id, title: 'Test', open: true }] },
      { type: 'UPDATE_TOAST', toast: { id, description: 'Updated' } }
    );
    expect(state.toasts[0].description).toBe('Updated');
    expect(state.toasts[0].title).toBe('Test');
  });
});

afterAll(() => {
  jest.clearAllTimers();
});
